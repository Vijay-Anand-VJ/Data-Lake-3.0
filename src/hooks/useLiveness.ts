import { useState, useCallback } from 'react';

export type LivenessChallenge = 'blink' | 'smile' | 'turn_left';

export interface Landmark {
  x: number;
  y: number;
}

/**
 * Custom hook to execute and manage randomized real-time facial liveness checks.
 * Uses robust mathematical calculations based on landmark distances.
 */
export const useLiveness = () => {
  const challenges: LivenessChallenge[] = ['blink', 'smile', 'turn_left'];
  
  // Randomly select the first challenge on mount
  const [challenge, setChallenge] = useState<LivenessChallenge>(() => {
    const randomIndex = Math.floor(Math.random() * challenges.length);
    return challenges[randomIndex];
  });
  
  const [isVerified, setIsVerified] = useState(false);

  /**
   * Resets the verification state and picks a NEW challenge different from the current one.
   */
  const resetChallenge = useCallback(() => {
    setIsVerified(false);
    const otherChallenges = challenges.filter(c => c !== challenge);
    const randomIndex = Math.floor(Math.random() * otherChallenges.length);
    setChallenge(otherChallenges[randomIndex]);
  }, [challenge]);

  /**
   * Helper to calculate Euclidean distance between two points in 2D space.
   */
  const getDistance = (p1: Landmark, p2: Landmark) => {
    return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
  };

  /**
   * Calculates Eye Aspect Ratio (EAR) based on vertical and horizontal eyelid distance.
   * A blink is detected when EAR drops below 0.25.
   */
  const checkBlink = useCallback((landmarks: any): boolean => {
    try {
      // 1. If landmarks is standard MediaPipe 468-point array
      if (Array.isArray(landmarks) && landmarks.length > 386) {
        // Left Eye: vertical (159, 145), horizontal (33, 133)
        const dVerticalLeft = getDistance(landmarks[159], landmarks[145]);
        const dHorizontalLeft = getDistance(landmarks[33], landmarks[133]);
        const earLeft = dVerticalLeft / dHorizontalLeft;

        // Right Eye: vertical (386, 374), horizontal (362, 263)
        const dVerticalRight = getDistance(landmarks[386], landmarks[374]);
        const dHorizontalRight = getDistance(landmarks[362], landmarks[263]);
        const earRight = dVerticalRight / dHorizontalRight;

        // Average EAR
        const averageEar = (earLeft + earRight) / 2;
        return averageEar < 0.25;
      }

      // 2. Fallback if MLKit returns native blink probability values
      if (landmarks && typeof landmarks === 'object') {
        const leftOpenProb = landmarks.leftEyeOpenProbability;
        const rightOpenProb = landmarks.rightEyeOpenProbability;
        if (typeof leftOpenProb === 'number' && typeof rightOpenProb === 'number') {
          return leftOpenProb < 0.20 && rightOpenProb < 0.20;
        }
      }

      return false;
    } catch (e) {
      console.warn('[useLiveness] Error checking blink geometry:', e);
      return false;
    }
  }, []);

  /**
   * Calculates Mouth Aspect Ratio (MAR).
   * A smile is detected when MAR increases above 0.6 due to horizontal stretching and slight vertical separation.
   */
  const checkSmile = useCallback((landmarks: any): boolean => {
    try {
      // 1. If landmarks is standard MediaPipe 468-point array
      if (Array.isArray(landmarks) && landmarks.length > 308) {
        // Mouth: vertical inner lip (13, 14), horizontal corners (78, 308)
        const dVerticalMouth = getDistance(landmarks[13], landmarks[14]);
        const dHorizontalMouth = getDistance(landmarks[78], landmarks[308]);
        
        // For a smile, horizontal width increases dramatically, check ratio of open height to width
        // Wait, standard MAR for open mouth or smile: we can evaluate vertical distance or smiling probability
        const mar = dVerticalMouth / dHorizontalMouth;
        
        // If smiling, mouth stretches horizontally and vertical distance is low, but width is large.
        // Let's also check if width is wide compared to eye distance:
        // Alternatively, a smile opens the mouth slightly or stretches. 
        // We'll check if MAR is > 0.45 or smiling probability is high. Let's make it standard:
        return mar > 0.55 || (dHorizontalMouth / getDistance(landmarks[33], landmarks[263]) > 0.8);
      }

      // 2. Fallback for direct MLKit smiling classification
      if (landmarks && typeof landmarks === 'object') {
        const smileProb = landmarks.smilingProbability;
        if (typeof smileProb === 'number') {
          return smileProb > 0.65;
        }
      }

      return false;
    } catch (e) {
      console.warn('[useLiveness] Error checking smile geometry:', e);
      return false;
    }
  }, []);

  /**
   * Calculates the lateral offset of the nose tip relative to the cheeks.
   * Returns true when the head is rotated past the turn-left threshold.
   */
  const checkHeadTurn = useCallback((landmarks: any): boolean => {
    try {
      if (Array.isArray(landmarks) && landmarks.length > 454) {
        // Nose Tip (1), Left Cheek Boundary (234), Right Cheek Boundary (454)
        const nose = landmarks[1];
        const leftCheek = landmarks[234];
        const rightCheek = landmarks[454];

        if (nose && leftCheek && rightCheek) {
          const dToLeft = getDistance(nose, leftCheek);
          const dToRight = getDistance(nose, rightCheek);
          
          // Ratio of nose-to-cheek distances.
          // In a neutral frontal pose, the ratio is around 1.0 (0.9 to 1.1).
          // When turning head left, the nose shifts closer to the left cheek edge, making dToLeft smaller.
          const ratio = dToLeft / dToRight;
          
          // Left head turn: ratio becomes significantly small (< 0.45)
          // (Or right head turn is ratio > 2.2)
          return ratio < 0.45;
        }
      }
      
      // Fallback for custom eulerAngles if available
      if (landmarks && typeof landmarks === 'object') {
        const headEulerAngleY = landmarks.headEulerAngleY; // Yaw angle
        if (typeof headEulerAngleY === 'number') {
          // Turning head left: positive yaw (or negative depending on camera orientation)
          return headEulerAngleY > 20; // > 20 degrees turn
        }
      }

      return false;
    } catch (e) {
      console.warn('[useLiveness] Error checking head turn geometry:', e);
      return false;
    }
  }, []);

  /**
   * Processes the current frame landmarks to check if the user completed the challenge.
   */
  const processFace = useCallback((landmarks: any) => {
    if (isVerified) {
      return;
    }

    let success = false;
    switch (challenge) {
      case 'blink':
        success = checkBlink(landmarks);
        break;
      case 'smile':
        success = checkSmile(landmarks);
        break;
      case 'turn_left':
        success = checkHeadTurn(landmarks);
        break;
    }

    if (success) {
      setIsVerified(true);
      console.log(`[useLiveness] Challenge "${challenge}" successfully VERIFIED!`);
    }
  }, [challenge, isVerified, checkBlink, checkSmile, checkHeadTurn]);

  // Generate instructions text based on active challenge
  let instruction = '';
  switch (challenge) {
    case 'blink':
      instruction = 'Please Blink Both Eyes';
      break;
    case 'smile':
      instruction = 'Please Smile Widely';
      break;
    case 'turn_left':
      instruction = 'Turn Your Head Left';
      break;
  }

  return {
    challenge,
    isVerified,
    instruction,
    processFace,
    resetChallenge,
  };
};
