export class SystemSyncService {
  private static version: number = Date.now();

  public static getVersion(): number {
    return SystemSyncService.version;
  }

  public static notifyChange(): number {
    SystemSyncService.version = Date.now();
    return SystemSyncService.version;
  }
}
