import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Bell,
  BookOpen,
  CalendarDays,
  Clapperboard,
  DollarSign,
  Gamepad2,
  GraduationCap,
  Home,
  ListChecks,
  Music,
  Palette,
  Settings,
  ShoppingCart,
  StickyNote,
  Target,
} from 'lucide-react';
import './Layout.css';
import Sidebar from './layout/Sidebar';

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
    { path: '/hobby/estudo', icon: GraduationCap, label: 'Estudo' },
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
    <div className="layout app-shell">
      <Sidebar
        primaryNavItems={primaryNavItems}
        secondaryNavItems={secondaryNavItems}
        hobbyItems={hobbyItems}
        shoppingItems={shoppingItems}
        notesItems={notesItems}
        isHobbyActive={isHobbyActive}
        isShoppingActive={isShoppingActive}
        isNotesActive={isNotesActive}
        isHobbyOpen={isHobbyOpen}
        isShoppingOpen={isShoppingOpen}
        isNotesOpen={isNotesOpen}
        setIsHobbyOpen={setIsHobbyOpen}
        setIsShoppingOpen={setIsShoppingOpen}
        setIsNotesOpen={setIsNotesOpen}
      />

      <main className="main main-content">{children}</main>
    </div>
  );
};

export default Layout;
