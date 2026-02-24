import { useNavigate } from 'react-router-dom';
import './Header.css';

interface HeaderProps {
  title?: string;
  username?: string;
}

function Header({ title, username }: HeaderProps) {
  const navigate = useNavigate();

  return (
    <div className="header">
      <button className="header-back-button" onClick={() => navigate('/')}>
        ← Back to Home
      </button>
      {username && (
        <span className="header-user-info">
          Logged in as: <strong>{username}</strong>
        </span>
      )}
      {title && <h1 className="header-title">{title}</h1>}
    </div>
  );
}

export default Header;

