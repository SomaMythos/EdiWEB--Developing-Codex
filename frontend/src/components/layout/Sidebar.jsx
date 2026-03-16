import React, { useEffect, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { ChevronDown, ChevronRight, Heart, ShoppingCart, StickyNote } from 'lucide-react';
import Notifications from '../Notifications';
import logo from '../../assets/logo_2.png';

function SidebarClock() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(new Date());
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  const timeLabel = new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(now);

  return (
    <div className="sidebar-clock" aria-label={`Horario atual ${timeLabel}`}>
      <div className="sidebar-clock__time">{timeLabel}</div>
    </div>
  );
}

const Sidebar = ({
  primaryNavItems,
  secondaryNavItems,
  hobbyItems,
  shoppingItems,
  notesItems,
  isHobbyActive,
  isShoppingActive,
  isNotesActive,
  isHobbyOpen,
  isShoppingOpen,
  isNotesOpen,
  setIsHobbyOpen,
  setIsShoppingOpen,
  setIsNotesOpen,
}) => (
  <aside className="sidebar grainy distressed">
    <div className="sidebar-header brand-block grainy distressed">
      <Link to="/" className="sidebar-brand" aria-label="Abrir Home">
        <img src={logo} alt="EDI Logo" className="logo-img brand-logo" />
        <p className="logo-subtitle brand-name">Life Manager</p>
      </Link>
    </div>

    <nav className="sidebar-nav nav-list">
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

        <div className={`nav-subitems submenu ${isHobbyOpen ? 'expanded' : ''}`}>
          {hobbyItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => `nav-item nav-subitem submenu-item ${isActive ? 'active' : ''}`}
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

        <div className={`nav-subitems submenu ${isShoppingOpen ? 'expanded' : ''}`}>
          {shoppingItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => `nav-item nav-subitem submenu-item ${isActive ? 'active' : ''}`}
              end={item.path === '/shopping'}
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

        <div className={`nav-subitems submenu ${isNotesOpen ? 'expanded' : ''}`}>
          {notesItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => `nav-item nav-subitem submenu-item ${isActive ? 'active' : ''}`}
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

    <div className="sidebar-footer grainy distressed">
      <Notifications />
      <SidebarClock />
    </div>
  </aside>
);

export default Sidebar;
