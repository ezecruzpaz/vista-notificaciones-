export default function Header({ currentUser, isConnected, onLogout }) {
  return (
    <header className="bg-white border-b border-gray-200 py-4">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-gray-900">
            Hola, <span className="text-blue-600">{currentUser}</span>
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <div
            className={`px-3 py-1 rounded-full text-xs font-semibold ${
              isConnected ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
            }`}
          >
            {isConnected ? '● Conectado' : '● Desconectado'}
          </div>

          <button
            onClick={onLogout}
            className="flex items-center gap-1 px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-medium transition-colors"
          >
            Cerrar Sesión
          </button>
        </div>
      </div>
    </header>
  );
}