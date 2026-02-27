import React, { useState, useEffect } from 'react';

// Symbol definitions from the manual
const SYMBOLS = {
  '#001': '🚗', // Driver/Driving
  '#002': '🔨', // Other work
  '#003': '⏸️', // Availability
  '#004': '🛏️', // Break/Rest
  '#005': '💳', // Card
  '#006': '🖨️', // Print
  '#007': '🚛', // Vehicle
  '#008': '✏️', // Input
  '#009': '📺', // Display
  '#010': '🌍', // Location/Time
  '#011': '🏁', // Start
  '#012': '🏁', // End
  '#013': '🛰️', // GNSS
  '#016': '💰', // Tolling
  '#023': '📶', // Bluetooth
  '#027': '⚡', // Speed
  '#028': '⏰', // Clock
  '#029': 'ℹ️', // Info
  '#031': '🔌', // Sensor
  '#036': '?', // Unknown
  '#037': '🏢', // Company
  '#038': '👮', // Control
  '#039': '🔧', // Calibration
  '#040': '⚙️', // Manufacturer
};

type MenuStructure = {
  id: string;
  label: string;
  symbols?: string[];
  children?: MenuStructure[];
};

const MENU_DATA: MenuStructure[] = [
  {
    id: 'print-driver1',
    label: 'VÝTISK ŘIDIČ 1',
    symbols: ['#005', '#006'],
    children: [
      { id: 'print-d1-day', label: '24h DEN-TISK', symbols: ['#005', '#006'] },
      { id: 'print-d1-event', label: 'UDÁLOST', symbols: ['#005', '#006'] },
      { id: 'print-d1-activity', label: 'AKTIVITY', symbols: ['#005', '#006'] },
    ],
  },
  {
    id: 'print-driver2',
    label: 'VÝTISK ŘIDIČ 2',
    symbols: ['#005', '#006'],
    children: [
      { id: 'print-d2-day', label: '24h DEN-TISK', symbols: ['#005', '#006'] },
      { id: 'print-d2-event', label: 'UDÁLOST', symbols: ['#005', '#006'] },
      { id: 'print-d2-activity', label: 'AKTIVITY', symbols: ['#005', '#006'] },
    ],
  },
  {
    id: 'print-vehicle',
    label: 'VÝTISK VOZIDLO',
    symbols: ['#007', '#006'],
    children: [
      { id: 'print-v-day', label: '24h DEN-TISK', symbols: ['#007', '#006'] },
      { id: 'print-v-event', label: 'UDÁLOST', symbols: ['#007', '#006'] },
      { id: 'print-v-speed', label: 'VYS. RYCHLOST', symbols: ['#027', '#027', '#006'] },
      { id: 'print-v-tech', label: 'TECH. DATA', symbols: ['#039', '#028', '#006'] },
      { id: 'print-v-cards', label: 'KARTY', symbols: ['#040', '#005', '#028', '#006'] },
    ],
  },
  {
    id: 'input-driver1',
    label: 'ZADÁNÍ ŘIDIČ 1',
    symbols: ['#008'],
    children: [
      { id: 'input-d1-start', label: 'VÝCHOZÍ ZEMĚ', symbols: ['#010', '#011'] },
      { id: 'input-d1-end', label: 'CÍLOVÁ ZEMĚ', symbols: ['#012', '#010'] },
      { id: 'input-d1-settings', label: 'NASTAVENÍ', symbols: ['#036', '#008'] },
      { id: 'input-d1-bluetooth', label: 'BLUETOOTH', symbols: ['#023'] },
    ],
  },
  {
    id: 'input-vehicle',
    label: 'ZADÁNÍ VOZIDLO',
    symbols: ['#007', '#008'],
    children: [
      { id: 'input-v-out', label: 'ZAČÁTEK/KONEC OUT', symbols: ['#011', '#012'] },
      { id: 'input-v-ferry', label: 'TRAJEKT/VLAK', symbols: ['#011', '#012'] },
      { id: 'input-v-loading', label: 'NALOŽ./VYLOŽ.', symbols: [] },
      { id: 'input-v-time', label: 'MÍSTNÍ ČAS', symbols: ['#010', '#028'] },
      { id: 'input-v-bluetooth', label: 'BLUETOOTH SPRÁVA', symbols: ['#023'] },
    ],
  },
  {
    id: 'display-driver1',
    label: 'DISPLEJ ŘIDIČ 1',
    symbols: ['#005', '#009'],
    children: [
      { id: 'display-d1-day', label: '24h DEN', symbols: ['#005', '#009'] },
      { id: 'display-d1-event', label: 'UDÁLOST', symbols: ['#005', '#009'] },
    ],
  },
  {
    id: 'display-vehicle',
    label: 'DISPLEJ VOZIDLO',
    symbols: ['#007', '#009'],
    children: [
      { id: 'display-v-day', label: '24h DEN', symbols: ['#007', '#009'] },
      { id: 'display-v-event', label: 'UDÁLOST', symbols: ['#007', '#009'] },
      { id: 'display-v-speed', label: 'VYS. RYCHLOST', symbols: ['#027', '#027', '#009'] },
      { id: 'display-v-tech', label: 'TECH. DATA', symbols: ['#039', '#028', '#009'] },
      { id: 'display-v-version', label: 'VERZE DTCO', symbols: ['#029', '#040'] },
    ],
  },
];

export default function TachographSimulator() {
  const [time, setTime] = useState(new Date());
  const [cardInserted, setCardInserted] = useState(false);
  const [ignitionOn, setIgnitionOn] = useState(true);
  const [currentScreen, setCurrentScreen] = useState<'main' | 'menu' | 'submenu' | 'card-insert'>('main');
  const [menuPath, setMenuPath] = useState<number[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [driverName] = useState('Novák Jan');
  const [displayOn, setDisplayOn] = useState(true);

  // Clock update
  useEffect(() => {
    const interval = setInterval(() => {
      setTime(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Handle ignition off - display dims after 1 minute
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (!ignitionOn) {
      timer = setTimeout(() => {
        setDisplayOn(false);
      }, 3000); // Simplified to 3 seconds for demo
    } else {
      setDisplayOn(true);
    }
    return () => clearTimeout(timer);
  }, [ignitionOn]);

  const getCurrentMenu = (): MenuStructure[] => {
    if (menuPath.length === 0) return MENU_DATA;
    let current = MENU_DATA;
    for (const index of menuPath) {
      if (current[index]?.children) {
        current = current[index].children!;
      }
    }
    return current;
  };

  const handleOK = () => {
    if (!displayOn) {
      setDisplayOn(true);
      return;
    }

    if (currentScreen === 'main') {
      setCurrentScreen('menu');
      setSelectedIndex(0);
    } else if (currentScreen === 'menu' || currentScreen === 'submenu') {
      const currentMenu = getCurrentMenu();
      if (currentMenu[selectedIndex]?.children) {
        setMenuPath([...menuPath, selectedIndex]);
        setSelectedIndex(0);
        setCurrentScreen('submenu');
      } else {
        // Action selected - show confirmation
        alert(`Akce: ${currentMenu[selectedIndex].label}`);
      }
    } else if (currentScreen === 'card-insert') {
      setCurrentScreen('main');
    }
  };

  const handleBack = () => {
    if (!displayOn) {
      setDisplayOn(true);
      return;
    }

    if (currentScreen === 'submenu' && menuPath.length > 0) {
      const newPath = [...menuPath];
      newPath.pop();
      setMenuPath(newPath);
      setSelectedIndex(0);
      if (newPath.length === 0) {
        setCurrentScreen('menu');
      }
    } else if (currentScreen === 'menu') {
      setCurrentScreen('main');
      setMenuPath([]);
      setSelectedIndex(0);
    }
  };

  const handleUp = () => {
    if (!displayOn) {
      setDisplayOn(true);
      return;
    }
    if (currentScreen === 'menu' || currentScreen === 'submenu') {
      const currentMenu = getCurrentMenu();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : currentMenu.length - 1));
    }
  };

  const handleDown = () => {
    if (!displayOn) {
      setDisplayOn(true);
      return;
    }
    if (currentScreen === 'menu' || currentScreen === 'submenu') {
      const currentMenu = getCurrentMenu();
      setSelectedIndex((prev) => (prev < currentMenu.length - 1 ? prev + 1 : 0));
    }
  };

  const handleCardInsert = () => {
    setCardInserted(!cardInserted);
    if (!cardInserted) {
      setCurrentScreen('card-insert');
      setTimeout(() => {
        setCurrentScreen('main');
      }, 3000);
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' });
  };

  const formatUTC = (date: Date) => {
    return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });
  };

  const renderSymbols = (symbols?: string[]) => {
    if (!symbols || symbols.length === 0) return null;
    return (
      <span className="text-sm">
        {symbols.map((sym, idx) => (
          <span key={idx} className="mx-0.5">
            {SYMBOLS[sym as keyof typeof SYMBOLS] || sym}
          </span>
        ))}
      </span>
    );
  };

  const renderScreen = () => {
    if (!displayOn) {
      return (
        <div className="h-full flex items-center justify-center">
          <div className="text-gray-700 text-xs">STANDBY</div>
        </div>
      );
    }

    if (currentScreen === 'card-insert') {
      return (
        <div className="p-3 space-y-2">
          <div className="flex items-center gap-2">
            <span>1{SYMBOLS['#001']}</span>
            <span className="text-sm">{driverName}</span>
          </div>
          <div className="text-xs text-right">
            {formatTime(time)}{SYMBOLS['#010']} {formatUTC(time)}UTC
          </div>
          <div className="text-center text-xs mt-4 animate-pulse">Načítání...</div>
        </div>
      );
    }

    if (currentScreen === 'main') {
      return (
        <div className="p-3 space-y-1">
          <div className="flex justify-between items-center text-xs">
            <div className="flex items-center gap-1">
              {cardInserted && (
                <>
                  <span>1{SYMBOLS['#005']}</span>
                  <span className="truncate max-w-[100px]">{driverName}</span>
                </>
              )}
            </div>
            <div className="flex items-center gap-1">
              <span>{SYMBOLS['#023']}</span>
              <span>{SYMBOLS['#027']}</span>
            </div>
          </div>
          <div className="text-right text-sm">
            {formatTime(time)}{SYMBOLS['#010']}
          </div>
          <div className="text-xs text-gray-400">
            UTC: {formatUTC(time)}
          </div>
          <div className="border-t border-gray-600 pt-2 mt-2">
            <div className="flex items-center gap-2 text-xs">
              <span>{SYMBOLS['#001']}</span>
              <span>00:00</span>
              <span>{SYMBOLS['#004']}</span>
              <span>08:30</span>
            </div>
          </div>
          {!cardInserted && (
            <div className="text-center text-xs mt-2 animate-pulse">
              {SYMBOLS['#005']} karta!
            </div>
          )}
          <div className="text-center text-xs text-gray-500 mt-3">
            Stiskněte OK pro menu
          </div>
        </div>
      );
    }

    if (currentScreen === 'menu' || currentScreen === 'submenu') {
      const currentMenu = getCurrentMenu();
      return (
        <div className="p-2">
          <div className="text-xs text-center mb-2 pb-1 border-b border-gray-600">
            {menuPath.length === 0 ? 'HLAVNÍ MENU' : 'PODMENU'}
          </div>
          <div className="space-y-1">
            {currentMenu.map((item, idx) => (
              <div
                key={item.id}
                className={`px-2 py-1 text-xs flex items-center justify-between ${
                  idx === selectedIndex ? 'bg-blue-900 bg-opacity-50' : ''
                }`}
              >
                <span className="flex items-center gap-1">
                  {renderSymbols(item.symbols)}
                  <span className="truncate">{item.label}</span>
                </span>
                {item.children && <span>→</span>}
              </div>
            ))}
          </div>
        </div>
      );
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-gradient-to-b from-gray-900 to-black rounded-2xl shadow-2xl p-6 border-4 border-gray-700">
          {/* Device Header */}
          <div className="text-center mb-4">
            <div className="text-gray-400 text-xs font-mono">VDO DTCO 4.1x</div>
            <div className="text-gray-500 text-xs">Digitální tachograf</div>
          </div>

          {/* LCD Display */}
          <div
            className={`bg-gradient-to-b from-green-950 to-green-900 rounded-lg p-1 shadow-inner border-2 border-gray-800 mb-6 ${
              displayOn ? 'opacity-100' : 'opacity-30'
            }`}
          >
            <div className="bg-green-900 bg-opacity-40 rounded h-48 text-green-100 font-mono text-sm">
              {renderScreen()}
            </div>
          </div>

          {/* Control Buttons */}
          <div className="space-y-4">
            {/* Navigation Arrows */}
            <div className="flex justify-center">
              <div className="grid grid-cols-3 gap-2">
                <div></div>
                <button
                  onClick={handleUp}
                  className="w-14 h-14 bg-gray-700 hover:bg-gray-600 rounded-lg shadow-lg active:shadow-inner flex items-center justify-center text-white text-xl font-bold"
                >
                  ▲
                </button>
                <div></div>
                <button
                  onClick={handleBack}
                  className="w-14 h-14 bg-gray-700 hover:bg-gray-600 rounded-lg shadow-lg active:shadow-inner flex items-center justify-center text-white text-xs"
                >
                  ◄<br />Zpět
                </button>
                <button
                  onClick={handleOK}
                  className="w-14 h-14 bg-green-700 hover:bg-green-600 rounded-lg shadow-lg active:shadow-inner flex items-center justify-center text-white font-bold"
                >
                  OK
                </button>
                <div></div>
                <div></div>
                <button
                  onClick={handleDown}
                  className="w-14 h-14 bg-gray-700 hover:bg-gray-600 rounded-lg shadow-lg active:shadow-inner flex items-center justify-center text-white text-xl font-bold"
                >
                  ▼
                </button>
                <div></div>
              </div>
            </div>

            {/* Additional Controls */}
            <div className="flex justify-around gap-2 pt-4 border-t border-gray-700">
              <button
                onClick={handleCardInsert}
                className={`px-4 py-2 rounded-lg shadow-lg text-xs font-semibold ${
                  cardInserted
                    ? 'bg-red-700 hover:bg-red-600 text-white'
                    : 'bg-blue-700 hover:bg-blue-600 text-white'
                }`}
              >
                {cardInserted ? '💳 Vyjmout kartu' : '💳 Vložit kartu'}
              </button>
              <button
                onClick={() => setIgnitionOn(!ignitionOn)}
                className={`px-4 py-2 rounded-lg shadow-lg text-xs font-semibold ${
                  ignitionOn
                    ? 'bg-orange-700 hover:bg-orange-600 text-white'
                    : 'bg-gray-600 hover:bg-gray-500 text-white'
                }`}
              >
                🔑 {ignitionOn ? 'Vypnout' : 'Zapnout'}
              </button>
            </div>
          </div>

          {/* Status Indicators */}
          <div className="flex justify-center gap-3 mt-6 pt-4 border-t border-gray-700">
            <div className="flex items-center gap-1">
              <div className={`w-2 h-2 rounded-full ${ignitionOn ? 'bg-green-500' : 'bg-gray-600'}`}></div>
              <span className="text-xs text-gray-400">Zapalování</span>
            </div>
            <div className="flex items-center gap-1">
              <div className={`w-2 h-2 rounded-full ${cardInserted ? 'bg-blue-500' : 'bg-gray-600'}`}></div>
              <span className="text-xs text-gray-400">Karta</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
