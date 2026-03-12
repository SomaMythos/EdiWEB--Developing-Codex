import React, { useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import {
  Bell,
  BookOpen,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  Clapperboard,
  DollarSign,
  Gamepad2,
  Heart,
  Home,
  ListChecks,
  Music,
  Palette,
  Settings,
  ShoppingCart,
  StickyNote,
  Target,
} from 'lucide-react';
import Notifications from './Notifications';
import './Layout.css';
import logo from '../assets/logo_2.png';

const Layout = ({ children }) => {
  const [isHobbyOpen, setIsHobbyOpen] = useState(true);
  const [isShoppingOpen, setIsShoppingOpen] = useState(true);
  const [isNotesOpen, setIsNotesOpen] = useState(true);
  const location = useLocation();

  const primaryNavItems = [
    { path: '/', icon: Home, label: 'Home' },
    { path: '/daily', icon: CalendarDays, label: 'Daily' },
    { path: '/goals', icon: Target, label: 'Metas' },
  ];

  const secondaryNavItems = [
    { path: '/financeiro', icon: DollarSign, label: 'Financeiro' },
    { path: '/calendario', icon: CalendarDays, label: 'Calendário' },
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

  const notesItems = [
    { path: '/anotacoes', icon: StickyNote, label: 'Notas' },
    { path: '/anotacoes/diario', icon: CalendarDays, label: 'Diário' },
  ];

  const isHobbyActive = hobbyItems.some((item) => location.pathname === item.path);
  const isShoppingActive = shoppingItems.some((item) => location.pathname === item.path);
  const isNotesActive = notesItems.some((item) => location.pathname === item.path);

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="sidebar-header">
          <Link to="/" className="sidebar-brand" aria-label="Abrir Home">
            <img src={logo} alt="EDI Logo" className="logo-img" />
            <p className="logo-subtitle">Life Manager</p>
          </Link>
        </div>

        <nav className="sidebar-nav">
          {primaryNavItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
              end={item.path === '/'}
            >
              <item.icon size={20} />
              <span>{item.label}</span>
            </NavLink>
          ))}

          <div className="nav-group">
            <button
              type="button"
              className={`nav-item nav-parent ${isHobbyActive ? 'active' : ''}`}
              onClick={() => setIsHobbyOpen((prev) => !prev)}
            >
              <Heart size={20} />
              <span>Hobby</span>
              <span className="nav-chevron-wrapper">
                {isHobbyOpen ? <ChevronDown size={16} className="nav-chevron" /> : <ChevronRight size={16} className="nav-chevron" />}
              </span>
            </button>

            <div className={`nav-subitems ${isHobbyOpen ? 'expanded' : ''}`}>
              {hobbyItems.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={({ isActive }) => `nav-item nav-subitem ${isActive ? 'active' : ''}`}
                >
                  <item.icon size={18} />
                  <span>{item.label}</span>
                </NavLink>
              ))}
            </div>
          </div>

          <div className="nav-group">
            <button
              type="button"
              className={`nav-item nav-parent ${isShoppingActive ? 'active' : ''}`}
              onClick={() => setIsShoppingOpen((prev) => !prev)}
            >
              <ShoppingCart size={20} />
              <span>Shopping</span>
              <span className="nav-chevron-wrapper">
                {isShoppingOpen ? <ChevronDown size={16} className="nav-chevron" /> : <ChevronRight size={16} className="nav-chevron" />}
              </span>
            </button>

            <div className={`nav-subitems ${isShoppingOpen ? 'expanded' : ''}`}>
              {shoppingItems.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={({ isActive }) => `nav-item nav-subitem ${isActive ? 'active' : ''}`}
                >
                  <item.icon size={18} />
                  <span>{item.label}</span>
                </NavLink>
              ))}
            </div>
          </div>

          <div className="nav-group">
            <button
              type="button"
              className={`nav-item nav-parent ${isNotesActive ? 'active' : ''}`}
              onClick={() => setIsNotesOpen((prev) => !prev)}
            >
              <StickyNote size={20} />
              <span>Anotações</span>
              <span className="nav-chevron-wrapper">
                {isNotesOpen ? <ChevronDown size={16} className="nav-chevron" /> : <ChevronRight size={16} className="nav-chevron" />}
              </span>
            </button>

            <div className={`nav-subitems ${isNotesOpen ? 'expanded' : ''}`}>
              {notesItems.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={({ isActive }) => `nav-item nav-subitem ${isActive ? 'active' : ''}`}
                  end={item.path === '/anotacoes'}
                >
                  <item.icon size={18} />
                  <span>{item.label}</span>
                </NavLink>
              ))}
            </div>
          </div>

          {secondaryNavItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
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

      <main className="main-content">{children}</main>
    </div>
  );
};

export default Layout;
