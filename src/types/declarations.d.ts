declare module 'react-native-sqlite-storage' {
  export interface SQLiteDatabase {
    executeSql(statement: string, params?: any[]): Promise<[any]>;
    transaction(callback: (tx: any) => void): Promise<any>;
  }

  export function openDatabase(
    params: {
      name: string;
      location?: string;
      createFromLocation?: string | number;
    },
    success?: () => void,
    error?: (err: any) => void
  ): Promise<SQLiteDatabase>;

  export function enablePromise(enable: boolean): void;

  const SQLite: {
    openDatabase: typeof openDatabase;
    enablePromise: typeof enablePromise;
  };

  export default SQLite;
}
