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
  ListChecks,
  Bell,
  ChevronDown,
  ChevronRight,
  Heart,
  Music,
  Gamepad2,
  Clapperboard,
  DollarSign,
  StickyNote,
} from 'lucide-react';
import Notifications from './Notifications';
import './Layout.css';
import logo from '../assets/logo_2.png';

const Layout = ({ children }) => {
  const [isHobbyOpen, setIsHobbyOpen] = useState(true);
  const [isShoppingOpen, setIsShoppingOpen] = useState(true);
  const location = useLocation();

  const navItems = [
    { path: '/', icon: Calendar, label: 'Daily' },
    { path: '/goals', icon: Target, label: 'Metas' },
	{ path: '/financeiro', icon: DollarSign, label: 'Financeiro' },
	{ path: '/anotacoes', icon: StickyNote, label: 'Anotações' },

	{ path: '/dashboard', icon: BarChart3, label: 'Dashboard' },
    { path: '/notifications', icon: Bell, label: 'Notificações' },
    { path: '/settings', icon: Settings, label: 'Configurações' },
  ];

  const hobbyItems = [
    { path: '/hobby/artes-visuais', icon: Palette, label: 'Artes Visuais' },
    { path: '/hobby/leitura', icon: BookOpen, label: 'Leitura' },
    { path: '/hobby/musica', icon: Music, label: 'Música' },
    { path: '/hobby/games', icon: Gamepad2, label: 'Games' },
    { path: '/hobby/assistir', icon: Clapperboard, label: 'Assistir' },
  ];

  const shoppingItems = [
    { path: '/shopping', icon: ListChecks, label: 'Wishlist' },
    { path: '/shopping/consumiveis', icon: ShoppingCart, label: 'Consumíveis' },
  ];

  const isHobbyActive = hobbyItems.some((item) => location.pathname === item.path);
  const isShoppingActive = shoppingItems.some((item) => location.pathname === item.path);

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
      <span className="nav-item-label">{item.label}</span>
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
  <span className="nav-item-label">Hobby</span>
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
          <span className="nav-item-label">{item.label}</span>
        </NavLink>
      ))}
    </div>
  </div>

  {/* Shopping */}
  <div className="nav-group">
    <button
      type="button"
      className={`nav-item nav-parent ${isShoppingActive ? 'active' : ''}`}
      onClick={() => setIsShoppingOpen((prev) => !prev)}
    >
      <ShoppingCart size={20} />
      <span className="nav-item-label">Shopping</span>
      <span className="nav-chevron-wrapper">
        {isShoppingOpen ? (
          <ChevronDown size={16} className="nav-chevron" />
        ) : (
          <ChevronRight size={16} className="nav-chevron" />
        )}
      </span>
    </button>

    <div className={`nav-subitems ${isShoppingOpen ? 'expanded' : ''}`}>
      {shoppingItems.map((item) => (
        <NavLink
          key={item.path}
          to={item.path}
          className={({ isActive }) =>
            `nav-item nav-subitem ${isActive ? 'active' : ''}`
          }
        >
          <item.icon size={18} />
          <span className="nav-item-label">{item.label}</span>
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
      <span className="nav-item-label">{item.label}</span>
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
