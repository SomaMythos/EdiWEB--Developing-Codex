import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  Calendar,
  Target,
  BarChart3,
  Settings,
  CheckCircle2,
  BookOpen,
  Palette,
  ShoppingCart,
  Bell,
  ChevronDown,
  ChevronRight,
  Heart,
  Music,
  Gamepad2,
  Clapperboard,
  DollarSign,
  Moon,
  Sun,
} from 'lucide-react';
import Notifications from './Notifications';
import { useTheme } from '../context/ThemeContext';
import './Layout.css';
import logo from '../assets/logo_2.png';

const Layout = ({ children }) => {
  const [isHobbyOpen, setIsHobbyOpen] = useState(true);
  const location = useLocation();

  const navItems = [
    { path: '/', icon: Calendar, label: 'Daily' },
    { path: '/goals', icon: Target, label: 'Metas' },
	{ path: '/shopping', icon: ShoppingCart, label: 'Shopping' },
	{ path: '/financeiro', icon: DollarSign, label: 'Financeiro' },

	{ path: '/dashboard', icon: BarChart3, label: 'Dashboard + Estatísticas' },
    { path: '/reminders', icon: Bell, label: 'Lembretes' },
    { path: '/settings', icon: Settings, label: 'Configurações' },
  ];

  const hobbyItems = [
    { path: '/hobby/artes-visuais', icon: Palette, label: 'Artes Visuais' },
    { path: '/hobby/leitura', icon: BookOpen, label: 'Leitura' },
    { path: '/hobby/musica', icon: Music, label: 'Música' },
    { path: '/hobby/games', icon: Gamepad2, label: 'Games' },
    { path: '/hobby/assistir', icon: Clapperboard, label: 'Assistir' },
  ];

  const isHobbyActive = hobbyItems.some((item) => location.pathname === item.path);

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="sidebar-header">
		<img src={logo} alt="EDI Logo" className="logo-img" />
		<p className="logo-subtitle">Life Manager</p>
	  </div>

<nav className="sidebar-nav">
  {/* Daily + Metas */}
  {navItems.slice(0, 2).map((item) => (
    <NavLink
      key={item.path}
      to={item.path}
      className={({ isActive }) =>
        `nav-item ${isActive ? 'active' : ''}`
      }
    >
      <item.icon size={20} />
      <span>{item.label}</span>
    </NavLink>
  ))}

  {/* Hobby */}
  <div className="nav-group">
    <button
  type="button"
  className={`nav-item nav-parent ${isHobbyActive ? 'active' : ''}`}
  onClick={() => setIsHobbyOpen((prev) => !prev)}
>
  <Heart size={20} />
  <span>Hobby</span>
  <span className="nav-chevron-wrapper">
    {isHobbyOpen ? (
      <ChevronDown size={16} className="nav-chevron" />
    ) : (
      <ChevronRight size={16} className="nav-chevron" />
    )}
  </span>
</button>

    <div className={`nav-subitems ${isHobbyOpen ? 'expanded' : ''}`}>
      {hobbyItems.map((item) => (
        <NavLink
          key={item.path}
          to={item.path}
          className={({ isActive }) =>
            `nav-item nav-subitem ${isActive ? 'active' : ''}`
          }
        >
          <item.icon size={18} />
          <span>{item.label}</span>
        </NavLink>
      ))}
    </div>
  </div>

  {/* Restante do menu */}
  {navItems.slice(2).map((item) => (
    <NavLink
      key={item.path}
      to={item.path}
      className={({ isActive }) =>
        `nav-item ${isActive ? 'active' : ''}`
      }
    >
      <item.icon size={20} />
      <span>{item.label}</span>
    </NavLink>
  ))}
</nav>

        <div className="sidebar-footer">
          <Notifications />
          <p className="version">v2.0.0</p>
        </div>
      </aside>

      <main className="main-content">
        {children}
      </main>
    </div>
  );
};

export default Layout;
