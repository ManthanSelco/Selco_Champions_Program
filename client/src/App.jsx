import { Routes, Route, Navigate } from 'react-router-dom';
import { ChampionsProvider } from './lib/ChampionsContext';
import { ToastProvider } from './components/ui/Toast';
import Home from './pages/Home';
import AdminApp from './pages/admin/AdminApp';

export default function App() {
  return (
    <ToastProvider>
      <ChampionsProvider>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/champion/:id" element={<Home />} />
          <Route path="/admin/*" element={<AdminApp />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </ChampionsProvider>
    </ToastProvider>
  );
}
