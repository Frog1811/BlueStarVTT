import { Link, useLocation } from 'react-router-dom'
import './Navbar.css'

interface NavbarProps {
  isAuthenticated?: boolean
}

function Navbar({ isAuthenticated = false }: NavbarProps) {
  const location = useLocation()

  return (
    <nav className="navbar">
      <div className="navbar-container">
        <div className="navbar-left">
          <Link to="/" className="navbar-brand">
            Blue Star VTT
          </Link>
        </div>
        <div className="navbar-right">
          <Link
            to="/"
            className={`navbar-link ${location.pathname === '/' ? 'active' : ''}`}
          >
            Home
          </Link>
          {isAuthenticated && (
            <>
              <Link
                to="/campaigns"
                className={`navbar-link ${location.pathname === '/campaigns' ? 'active' : ''}`}
              >
                My Campaigns
              </Link>
              <Link
                to="/bug-reports"
                className={`navbar-link ${location.pathname === '/bug-reports' ? 'active' : ''}`}
              >
                Bug Reports
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  )
}

export default Navbar

