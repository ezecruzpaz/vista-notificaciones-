export default function Login({ username, setUsername, onLogin }) {
  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-6">
      <div className="bg-white border border-gray-200 rounded-xl shadow-lg max-w-md w-full p-8 text-center">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Notificaciones</h1>
          <p className="text-gray-500 mt-2">Inicia sesión para continuar</p>
        </div>

        <div className="space-y-4">
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && onLogin()}
            placeholder="Nombre de usuario"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg text-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />

          <button
            onClick={onLogin}
            className="w-full py-3 bg-blue-500 text-white rounded-lg font-semibold text-lg hover:bg-blue-600 transition-colors"
          >
            Iniciar Sesión
          </button>
        </div>

        <div className="mt-6 pt-4 border-t border-gray-200">
          <p className="text-sm text-gray-400">Sistema de notificaciones en tiempo real</p>
        </div>
      </div>
    </div>
  );
}