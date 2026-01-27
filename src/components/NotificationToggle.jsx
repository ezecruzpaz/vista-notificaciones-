export default function NotificationToggle({
  notificationsEnabled,
  notificationStatus,
  onEnable,
  onDisable,
}) {
  if (notificationsEnabled) {
    return (
      <button
        onClick={onDisable}
        className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium transition-colors"
      >
        Desactivar Notificaciones
      </button>
    );
  }

  return (
    <div className="space-y-3">
      <button
        onClick={onEnable}
        className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg font-medium transition-colors"
      >
        Activar Notificaciones
      </button>
      {notificationStatus && (
        <p className="text-sm text-blue-700 bg-blue-50 p-3 rounded border-l-4 border-blue-500">
          {notificationStatus}
        </p>
      )}
    </div>
  );
}