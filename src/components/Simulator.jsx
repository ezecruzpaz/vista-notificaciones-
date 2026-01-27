export default function Simulator({
  targetUser,
  setTargetUser,
  taskTitle,
  setTaskTitle,
  taskDescription,
  setTaskDescription,
  onSendTask
}) {
  return (
    <section className="bg-white border border-gray-200 rounded-xl shadow-lg p-6">
      <div className="mb-4">
        <h2 className="text-xl font-bold text-gray-900">Simulador de Asignaciones</h2>
        <p className="text-sm text-gray-500">Envía notificaciones de prueba</p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <label className="block text-sm font-bold text-gray-700 uppercase tracking-wide">Usuario destino</label>
          <input
            type="text"
            value={targetUser}
            onChange={(e) => setTargetUser(e.target.value)}
            placeholder="Nombre del usuario"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg text-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-bold text-gray-700 uppercase tracking-wide">Título de la tarea</label>
          <input
            type="text"
            value={taskTitle}
            onChange={(e) => setTaskTitle(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg text-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-bold text-gray-700 uppercase tracking-wide">Descripción</label>
          <textarea
            value={taskDescription}
            onChange={(e) => setTaskDescription(e.target.value)}
            rows={4}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg text-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>

        <button
          onClick={onSendTask}
          className="w-full py-3 bg-blue-500 text-white rounded-lg font-semibold text-lg hover:bg-blue-600 transition-colors"
        >
          Enviar Notificación
        </button>
      </div>
    </section>
  );
}