import { useTranslation } from 'react-i18next'
import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation } from 'react-router'
import { AuthProvider, useAuth } from './auth'
import { Layout } from './components/Layout'
import { BoardCruxPage } from './pages/BoardCruxPage'
import { BoardListPage } from './pages/BoardListPage'
import { BoardSetPage } from './pages/BoardSetPage'
import { CoachPage } from './pages/CoachPage'
import { CruxDetailPage } from './pages/CruxDetailPage'
import { CruxListPage } from './pages/CruxListPage'
import { CruxNewPage } from './pages/CruxNewPage'
import { GymPage } from './pages/GymPage'
import { LoginPage } from './pages/LoginPage'
import { ThemeProvider } from './theme'

function RequireAuth() {
  const { t } = useTranslation()
  const { user, ready } = useAuth()
  const location = useLocation()

  if (!ready) {
    return (
      <div className="page">
        <p className="status-text">{t('common.loading')}</p>
      </div>
    )
  }
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }
  return <Outlet />
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<Layout />}>
              <Route path="/login" element={<LoginPage />} />
              <Route element={<RequireAuth />}>
                <Route index element={<Navigate to="/cruxes" replace />} />
                <Route path="/cruxes" element={<CruxListPage />} />
                <Route path="/cruxes/new" element={<CruxNewPage />} />
                <Route path="/cruxes/:id" element={<CruxDetailPage />} />
                <Route path="/gym" element={<GymPage />} />
                <Route path="/board" element={<BoardListPage />} />
                <Route path="/board/new" element={<BoardSetPage />} />
                <Route path="/board/:id" element={<BoardCruxPage />} />
                <Route path="/board/:id/edit" element={<BoardSetPage />} />
                <Route path="/coach" element={<CoachPage />} />
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  )
}
