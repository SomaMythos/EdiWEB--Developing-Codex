import React, { useEffect, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { ChevronDown, ChevronRight, Heart, Loader, ShoppingCart, StickyNote, Wifi, WifiOff } from 'lucide-react';
import Notifications from '../Notifications';
import logo from '../../assets/logo_2.png';
import { systemIntegrationApi } from '../../services/api';

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

function SidebarTunnelControl() {
  const [tunnel, setTunnel] = useState(null);
  const [pending, setPending] = useState(false);
  const [copied, setCopied] = useState(false);

  const loadTunnelStatus = async () => {
    try {
      const response = await systemIntegrationApi.getCloudflareTunnelStatus();
      setTunnel(response.data.data || null);
    } catch (error) {
      console.error('Erro ao buscar status do Cloudflare Tunnel:', error);
    }
  };

  useEffect(() => {
    loadTunnelStatus();
    const intervalId = window.setInterval(loadTunnelStatus, 15000);
    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    if (!copied) return undefined;
    const timeoutId = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(timeoutId);
  }, [copied]);

  const handleToggleTunnel = async () => {
    if (pending) return;

    try {
      setPending(true);
      const response = tunnel?.is_running
        ? await systemIntegrationApi.stopCloudflareTunnel()
        : await systemIntegrationApi.startCloudflareTunnel();
      setTunnel(response.data.data || null);
    } catch (error) {
      console.error('Erro ao alternar Cloudflare Tunnel:', error);
      window.alert(error?.response?.data?.detail || 'Não foi possível alternar o Cloudflare Tunnel.');
      await loadTunnelStatus();
    } finally {
      setPending(false);
    }
  };

  const handleCopyTunnelUrl = async () => {
    const url = tunnel?.copy_url;
    if (!url) return;

    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        window.prompt('Copie o link do túnel:', url);
      }
      setCopied(true);
    } catch (error) {
      console.error('Erro ao copiar link do túnel:', error);
      window.prompt('Copie o link do túnel:', url);
    }
  };

  const isRunning = Boolean(tunnel?.is_running);
  const isStarting = tunnel?.status === 'starting';
  const isAvailable = tunnel?.cloudflared_available !== false;
  const buttonLabel = pending ? (isRunning ? 'Desligando...' : 'Ligando...') : isStarting ? 'Conectando...' : isRunning ? 'Online' : 'Offline';

  return (
    <div className="sidebar-tunnel">
      <button
        type="button"
        className={`sidebar-tunnel__button ${isRunning ? 'is-online' : 'is-offline'} ${isStarting ? 'is-starting' : ''}`}
        onClick={handleToggleTunnel}
        disabled={pending || !isAvailable}
        title={tunnel?.public_url || tunnel?.known_public_url || 'Cloudflare Tunnel'}
      >
        {pending || isStarting ? (
          <Loader size={16} className="sidebar-tunnel__icon sidebar-tunnel__icon--spin" />
        ) : isRunning ? (
          <Wifi size={16} className="sidebar-tunnel__icon" />
        ) : (
          <WifiOff size={16} className="sidebar-tunnel__icon" />
        )}
        <span>{buttonLabel}</span>
      </button>

      <button
        type="button"
        className={`sidebar-tunnel__copy ${tunnel?.copy_url ? '' : 'is-disabled'}`}
        onClick={handleCopyTunnelUrl}
        disabled={!tunnel?.copy_url}
        title={tunnel?.copy_url || 'Nenhum link ativo'}
      >
        {copied ? 'Link copiado' : 'Copiar link do túnel'}
      </button>
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
      <SidebarTunnelControl />
    </div>
  </aside>
);

export default Sidebar;
