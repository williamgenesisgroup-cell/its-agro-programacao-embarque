/* oxlint-disable react/no-unescaped-entities, react-hooks/exhaustive-deps, react/react-compiler, jsx-a11y/no-autofocus, jsx-a11y/control-has-associated-label, jsx-a11y/prefer-tag-over-role, next/no-img-element */
'use client';

import {
  Activity,
  AlertTriangle,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  BarChart3,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronRight,
  CircleCheck,
  CircleDot,
  Clipboard,
  Clock3,
  Copy,
  Crosshair,
  Eye,
  FileText,
  GripVertical,
  History,
  House,
  Info,
  Layers3,
  LocateFixed,
  Map as MapIcon,
  MapPin,
  Menu,
  MessageCircle,
  Navigation,
  Pencil,
  Phone,
  Plus,
  RefreshCw,
  Route as RouteIcon,
  Search,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  UserCheck,
  UsersRound,
  UserX,
  X,
  Zap,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';

import {
  buildRoutePlan,
  estimateLeg,
  formatDistance,
  formatDuration,
  type RoutePlan,
  type RoutePoint,
  type RouteStop,
} from '@/lib/route-service';
import { compareCandidateToDestination } from '@/lib/logistics-service';
import {
  isDevelopmentSeedAllowed,
  readPersistedState,
  writePersistedState,
} from '@/lib/storage';

type View =
  | 'dashboard'
  | 'people'
  | 'locations'
  | 'schedule'
  | 'routes'
  | 'history';
type ScheduleStatus = 'Rascunho' | 'Programado' | 'Finalizado' | 'Cancelado';
type OperationalStatus =
  | 'Disponível'
  | 'Programado'
  | 'Em deslocamento'
  | 'No local'
  | 'Finalizado'
  | 'Indisponível';
type Person = {
  id: string;
  name: string;
  phone: string;
  cpf: string;
  city: string;
  uf: string;
  address: string;
  number: string;
  neighborhood: string;
  cep: string;
  complement: string;
  reference: string;
  lat: number | null;
  lng: number | null;
  notes: string;
  active: boolean;
  supervisor: string;
  currentLocation: string;
  lastLocationUpdate: string;
  operationalStatus: OperationalStatus;
};
type BoardingLocation = {
  id: string;
  name: string;
  type: string;
  city: string;
  uf: string;
  address: string;
  number: string;
  neighborhood: string;
  cep: string;
  complement: string;
  lat: number | null;
  lng: number | null;
  notes: string;
  active: boolean;
};
type SchedulePerson = RoutePoint & { sourcePersonId: string };
type SuggestionDecision = {
  id: string;
  date: string;
  scheduleId: string;
  originalPerson: string;
  suggestedPerson: string;
  originalKm: number;
  suggestedKm: number;
  economyKm: number;
  decision: 'APLICADA' | 'IGNORADA';
};
type Schedule = {
  id: string;
  createdAt: string;
  createdBy: string;
  date: string;
  time: string;
  locationId: string;
  destinationName: string;
  destinationAddress: string;
  destinationCity: string;
  destinationUf: string;
  destinationLat: number | null;
  destinationLng: number | null;
  description: string;
  notes: string;
  people: SchedulePerson[];
  originalOrder: string[];
  optimizedOrder: string[];
  routeStops: RouteStop[];
  totalKm: number | null;
  totalMinutes: number | null;
  status: ScheduleStatus;
  arrivalLeadMinutes: number;
  stopBufferMinutes: number;
};
type Toast = { message: string; tone: 'success' | 'error' | 'info' } | null;
type Comparison = {
  original: Person;
  suggested: Person;
  originalKm: number;
  suggestedKm: number;
  originalMin: number;
  suggestedMin: number;
} | null;
type CepLookupState = 'idle' | 'loading' | 'success' | 'error';
type ViaCepResult = {
  cep?: string;
  logradouro?: string;
  bairro?: string;
  localidade?: string;
  uf?: string;
  complemento?: string;
  erro?: boolean;
};

const OLIVE = '#5e6b40';
const NAV: { id: View; label: string; icon: LucideIcon }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: House },
  { id: 'people', label: 'Pessoas', icon: UsersRound },
  { id: 'locations', label: 'Locais de embarque', icon: MapPin },
  { id: 'schedule', label: 'Programação', icon: CalendarDays },
  { id: 'routes', label: 'Mapa da operação', icon: MapIcon },
  { id: 'history', label: 'Histórico', icon: History },
];
const LOCATION_TYPES = [
  'Aeroporto',
  'Rodoviária',
  'Hotel',
  'Empresa',
  'Unidade',
  'Armazém',
  'Fazenda',
  'Ponto de encontro',
  'Outro',
];
const OPERATIONAL_STATUSES: OperationalStatus[] = [
  'Disponível',
  'Programado',
  'Em deslocamento',
  'No local',
  'Finalizado',
  'Indisponível',
];

function todayIso() {
  const date = new Date();
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 10);
}
function makeId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
function formatDate(value: string) {
  return value
    ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' }).format(
        new Date(`${value}T12:00:00`),
      )
    : '—';
}
function longDate(value: string) {
  return value
    ? new Intl.DateTimeFormat('pt-BR', {
        weekday: 'long',
        day: '2-digit',
        month: 'long',
      }).format(new Date(`${value}T12:00:00`))
    : 'Escolha uma data';
}
function addressOf(item: {
  address: string;
  number: string;
  neighborhood?: string;
  city: string;
  uf: string;
}) {
  return `${[item.address, item.number].filter(Boolean).join(', ') || 'Endereço não informado'}${item.neighborhood ? ` - ${item.neighborhood}` : ''} · ${item.city || 'Cidade não informada'}${item.uf ? `/${item.uf}` : ''}`;
}
function toNumber(value: string) {
  if (!value.trim()) return null;
  const result = Number(value.replace(',', '.'));
  return Number.isFinite(result) ? result : null;
}
function cepDigits(value: string) {
  return value.replace(/\D/g, '').slice(0, 8);
}
function formatCep(value: string) {
  const digits = cepDigits(value);
  return digits.length > 5
    ? `${digits.slice(0, 5)}-${digits.slice(5)}`
    : digits;
}
function cssStatus(value: string) {
  return value.toLowerCase().replaceAll(' ', '-').replaceAll('ã', 'a');
}
function toPoint(person: Person): RoutePoint {
  return {
    id: person.id,
    label: person.name,
    address: addressOf(person),
    city: person.city,
    lat: person.lat ?? undefined,
    lng: person.lng ?? undefined,
  };
}
function destinationPoint(
  location: BoardingLocation | null,
  schedule: Schedule,
): RoutePoint {
  return {
    id: schedule.locationId || 'destination',
    label: location?.name || schedule.destinationName,
    address: schedule.destinationAddress,
    city: schedule.destinationCity,
    lat: schedule.destinationLat ?? undefined,
    lng: schedule.destinationLng ?? undefined,
  };
}
function snapshot(person: Person): SchedulePerson {
  return {
    id: person.id,
    sourcePersonId: person.id,
    label: person.name,
    address: addressOf(person),
    city: person.city,
    phone: person.phone,
    lat: person.lat ?? undefined,
    lng: person.lng ?? undefined,
  };
}
function emptyPerson(): Person {
  return {
    id: '',
    name: '',
    phone: '',
    cpf: '',
    city: '',
    uf: 'PR',
    address: '',
    number: '',
    neighborhood: '',
    cep: '',
    complement: '',
    reference: '',
    lat: null,
    lng: null,
    notes: '',
    active: true,
    supervisor: '',
    currentLocation: '',
    lastLocationUpdate: '',
    operationalStatus: 'Disponível',
  };
}
function emptyLocation(): BoardingLocation {
  return {
    id: '',
    name: '',
    type: 'Ponto de encontro',
    city: '',
    uf: 'PR',
    address: '',
    number: '',
    neighborhood: '',
    cep: '',
    complement: '',
    lat: null,
    lng: null,
    notes: '',
    active: true,
  };
}
function emptySchedule(): Schedule {
  return {
    id: makeId('schedule'),
    createdAt: new Date().toISOString(),
    createdBy: 'Operação',
    date: todayIso(),
    time: '15:00',
    locationId: '',
    destinationName: '',
    destinationAddress: '',
    destinationCity: '',
    destinationUf: '',
    destinationLat: null,
    destinationLng: null,
    description: '',
    notes: '',
    people: [],
    originalOrder: [],
    optimizedOrder: [],
    routeStops: [],
    totalKm: null,
    totalMinutes: null,
    status: 'Rascunho',
    arrivalLeadMinutes: 30,
    stopBufferMinutes: 10,
  };
}

const SEED_PEOPLE: Person[] = [
  {
    ...emptyPerson(),
    id: 'person-joao',
    name: 'João da Silva',
    phone: '(43) 99911-2040',
    city: 'Londrina',
    uf: 'PR',
    address: 'Rua Goiás',
    number: '880',
    neighborhood: 'Centro',
    cep: '86010-460',
    lat: -23.3108,
    lng: -51.1628,
    supervisor: 'Ana Paula',
    currentLocation: 'Londrina - PR',
    lastLocationUpdate: '04/09/2026 08:42',
  },
  {
    ...emptyPerson(),
    id: 'person-maria',
    name: 'Maria Souza',
    phone: '(43) 99812-7701',
    city: 'Cambé',
    uf: 'PR',
    address: 'Avenida Roberto Koch',
    number: '1450',
    neighborhood: 'Jardim Ana Rosa',
    lat: -23.2757,
    lng: -51.2773,
    supervisor: 'Ana Paula',
    currentLocation: 'Cambé - PR',
    lastLocationUpdate: '04/09/2026 08:35',
  },
  {
    ...emptyPerson(),
    id: 'person-carlos',
    name: 'Carlos Pereira',
    phone: '(44) 99771-3900',
    city: 'Maringá',
    uf: 'PR',
    address: 'Rua Neo Alves Martins',
    number: '460',
    neighborhood: 'Zona 01',
    lat: -23.4209,
    lng: -51.9331,
    supervisor: 'Marcos Lima',
    currentLocation: 'Maringá - PR',
    lastLocationUpdate: '04/09/2026 07:58',
  },
  {
    ...emptyPerson(),
    id: 'person-pedro',
    name: 'Pedro Silva',
    phone: '(43) 99640-1212',
    city: 'Rolândia',
    uf: 'PR',
    address: 'Rua Santos Dumont',
    number: '220',
    neighborhood: 'Centro',
    lat: -23.3097,
    lng: -51.3697,
    supervisor: 'Marcos Lima',
    currentLocation: 'Rolândia - PR',
    lastLocationUpdate: '04/09/2026 08:10',
  },
];
const SEED_LOCATIONS: BoardingLocation[] = [
  {
    ...emptyLocation(),
    id: 'location-aeroporto',
    name: 'Aeroporto de Londrina',
    type: 'Aeroporto',
    city: 'Londrina',
    uf: 'PR',
    address: 'Rua Tenente João Maurício de Medeiros',
    number: '300',
    neighborhood: 'Aeroporto',
    lat: -23.3336,
    lng: -51.1301,
  },
  {
    ...emptyLocation(),
    id: 'location-rodoviaria',
    name: 'Rodoviária de Londrina',
    type: 'Rodoviária',
    city: 'Londrina',
    uf: 'PR',
    address: 'Avenida Dez de Dezembro',
    number: '1830',
    neighborhood: 'Centro',
    lat: -23.3132,
    lng: -51.1572,
  },
  {
    ...emptyLocation(),
    id: 'location-its',
    name: "IT'S AGRO · Unidade Londrina",
    type: 'Empresa',
    city: 'Londrina',
    uf: 'PR',
    address: 'Rodovia Celso Garcia Cid',
    number: 'KM 382',
    neighborhood: 'Zona Rural',
    lat: -23.395,
    lng: -51.15,
  },
];
function seedSchedule(): Schedule {
  const location = SEED_LOCATIONS[0];
  const selected = SEED_PEOPLE.slice(0, 3).map(snapshot);
  return {
    ...emptySchedule(),
    id: 'schedule-demo',
    date: todayIso(),
    time: '15:00',
    locationId: location.id,
    destinationName: location.name,
    destinationAddress: addressOf(location),
    destinationCity: location.city,
    destinationUf: location.uf,
    destinationLat: location.lat,
    destinationLng: location.lng,
    description: 'Embarque de demonstração',
    people: selected,
    originalOrder: selected.map((person) => person.id),
    optimizedOrder: selected.map((person) => person.id),
    status: 'Programado',
  };
}

function Badge({
  children,
  tone = 'neutral',
}: {
  children: ReactNode;
  tone?: string;
}) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}
function IconButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick?: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className="icon-button"
      aria-label={label}
      title={label}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
function Field({
  label,
  children,
  hint,
  className = '',
}: {
  label: string;
  children: ReactNode;
  hint?: string;
  className?: string;
}) {
  return (
    <label className={`field ${className}`}>
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}
function SectionTitle({
  eyebrow,
  title,
  text,
  action,
}: {
  eyebrow?: string;
  title: string;
  text?: string;
  action?: ReactNode;
}) {
  return (
    <div className="section-title">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        {text && <p className="section-description">{text}</p>}
      </div>
      {action}
    </div>
  );
}
function Metric({
  icon: Icon,
  label,
  value,
  detail,
  tone,
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  detail: string;
  tone: string;
}) {
  return (
    <article className={`metric-card metric-${tone}`}>
      <div className="metric-head">
        <span className="metric-icon">
          <Icon size={18} />
        </span>
        <span>{label}</span>
      </div>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  );
}
function EmptyState({
  icon: Icon,
  title,
  text,
  action,
}: {
  icon: LucideIcon;
  title: string;
  text: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <div className="empty-icon">
        <Icon size={23} />
      </div>
      <h3>{title}</h3>
      <p>{text}</p>
      {action}
    </div>
  );
}
function statusIcon(status: OperationalStatus) {
  if (status === 'Disponível') return <CircleCheck size={14} />;
  if (status === 'Programado') return <CalendarDays size={14} />;
  if (status === 'Em deslocamento') return <Navigation size={14} />;
  if (status === 'No local') return <MapPin size={14} />;
  if (status === 'Finalizado') return <Check size={14} />;
  return <UserX size={14} />;
}
function mapPositions(points: RoutePoint[]) {
  const available = points.filter(
    (point) => point.lat != null && point.lng != null,
  );
  if (!available.length) return new Map<string, { x: number; y: number }>();
  const lats = available.map((point) => point.lat as number);
  const lngs = available.map((point) => point.lng as number);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const latRange = maxLat - minLat || 0.01;
  const lngRange = maxLng - minLng || 0.01;
  return new Map(
    available.map((point) => [
      point.id,
      {
        x: 10 + (((point.lng as number) - minLng) / lngRange) * 80,
        y: 88 - (((point.lat as number) - minLat) / latRange) * 76,
      },
    ]),
  );
}
function MiniMap({
  points,
  destination,
  title,
  selectedId,
  onSelect,
  zoom,
  onZoom,
}: {
  points: RoutePoint[];
  destination?: RoutePoint | null;
  title: string;
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  zoom: number;
  onZoom: (value: number) => void;
}) {
  const all = destination ? [...points, destination] : points;
  const positions = mapPositions(all);
  const line = all
    .map((point) => positions.get(point.id))
    .filter((point): point is { x: number; y: number } => Boolean(point))
    .map((point) => `${point.x},${point.y}`)
    .join(' ');
  return (
    <div className="map-shell">
      <div className="map-heading">
        <div>
          <p className="eyebrow">VISÃO ESPACIAL</p>
          <h3>{title}</h3>
        </div>
        <div className="map-controls">
          <button
            type="button"
            onClick={() => onZoom(Math.min(1.45, zoom + 0.1))}
            aria-label="Aumentar zoom"
          >
            +
          </button>
          <button
            type="button"
            onClick={() => onZoom(Math.max(0.9, zoom - 0.1))}
            aria-label="Reduzir zoom"
          >
            −
          </button>
        </div>
      </div>
      <div className="map-canvas" style={{ touchAction: 'pinch-zoom' }}>
        {!positions.size && (
          <div className="map-empty-state" role="status">
            <MapPin size={22} />
            <strong>Mapa pronto para receber a operação</strong>
            <span>
              Cadastre pessoas com latitude e longitude para exibir os
              marcadores e os trajetos.
            </span>
          </div>
        )}
        <div className="map-grid" style={{ transform: `scale(${zoom})` }}>
          <div className="map-watermark">
            IT'S AGRO
            <br />
            <span>OPERAÇÃO</span>
          </div>
          <svg
            className="map-lines"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <polyline
              points={line}
              fill="none"
              stroke={OLIVE}
              strokeWidth=".9"
              strokeDasharray="2 1.2"
            />
          </svg>
          {points.map((point, index) => {
            const position = positions.get(point.id);
            return position ? (
              <button
                type="button"
                className={`map-pin ${selectedId === point.id ? 'selected' : ''}`}
                style={{ left: `${position.x}%`, top: `${position.y}%` }}
                key={point.id}
                onClick={() => onSelect?.(point.id)}
                aria-label={`Abrir ${point.label}`}
              >
                <span>{String(index + 1).padStart(2, '0')}</span>
              </button>
            ) : null;
          })}
          {destination && positions.get(destination.id) && (
            <div
              className="map-destination"
              style={{
                left: `${positions.get(destination.id)?.x}%`,
                top: `${positions.get(destination.id)?.y}%`,
              }}
            >
              <span>D</span>
              <small>DESTINO</small>
            </div>
          )}
        </div>
        <div className="map-legend">
          <span>
            <i className="legend-pin">01</i>Classificador
          </span>
          <span>
            <i className="legend-destination">D</i>Destino
          </span>
          <span>
            <i className="legend-line" />
            Trajeto
          </span>
        </div>
      </div>
      <p className="map-note">
        <Info size={14} /> Preparado para provedor rodoviário. Sem chave
        configurada, a linha é uma estimativa por coordenadas.
      </p>
    </div>
  );
}

export default function Home() {
  const [view, setView] = useState<View>('dashboard');
  const [mobileMenu, setMobileMenu] = useState(false);
  const [ready, setReady] = useState(false);
  const [people, setPeople] = useState<Person[]>([]);
  const [locations, setLocations] = useState<BoardingLocation[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [suggestions, setSuggestions] = useState<SuggestionDecision[]>([]);
  const [costPerKm, setCostPerKm] = useState(1.2);
  const [toast, setToast] = useState<Toast>(null);
  const [personDraft, setPersonDraft] = useState<Person>(emptyPerson());
  const [locationDraft, setLocationDraft] =
    useState<BoardingLocation>(emptyLocation());
  const [showPersonForm, setShowPersonForm] = useState(false);
  const [showLocationForm, setShowLocationForm] = useState(false);
  const [personCepState, setPersonCepState] = useState<CepLookupState>('idle');
  const [personCepMessage, setPersonCepMessage] = useState('');
  const [locationCepState, setLocationCepState] =
    useState<CepLookupState>('idle');
  const [locationCepMessage, setLocationCepMessage] = useState('');
  const [personQuery, setPersonQuery] = useState('');
  const [personStatus, setPersonStatus] = useState('all');
  const [locationQuery, setLocationQuery] = useState('');
  const [scheduleDraft, setScheduleDraft] = useState<Schedule>(emptySchedule());
  const [routePlan, setRoutePlan] = useState<RoutePlan | null>(null);
  const [routeDirty, setRouteDirty] = useState(true);
  const [personPickerQuery, setPersonPickerQuery] = useState('');
  const [showNearby, setShowNearby] = useState(false);
  const [scheduleSearch, setScheduleSearch] = useState('');
  const [scheduleStatus, setScheduleStatus] = useState('all');
  const [historyStart, setHistoryStart] = useState('');
  const [historyEnd, setHistoryEnd] = useState('');
  const [mapSearch, setMapSearch] = useState('');
  const [mapStatus, setMapStatus] = useState('all');
  const [mapCity, setMapCity] = useState('all');
  const [mapSupervisor, setMapSupervisor] = useState('all');
  const [selectedMarkerId, setSelectedMarkerId] = useState<string | null>(null);
  const [mapZoom, setMapZoom] = useState(1);
  const [showMapFilters, setShowMapFilters] = useState(false);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [ignoredSuggestion, setIgnoredSuggestion] = useState(false);
  const [comparison, setComparison] = useState<Comparison>(null);

  useEffect(() => {
    const saved = readPersistedState();
    if (saved) {
      setPeople(saved.people as Person[]);
      setLocations(saved.locations as BoardingLocation[]);
      setSchedules(saved.schedules as Schedule[]);
      setSuggestions((saved.suggestions ?? []) as SuggestionDecision[]);
      setCostPerKm(saved.costPerKm ?? 1.2);
    } else if (isDevelopmentSeedAllowed()) {
      setPeople(SEED_PEOPLE);
      setLocations(SEED_LOCATIONS);
      setSchedules([seedSchedule()]);
    }
    setReady(true);
  }, []);
  useEffect(() => {
    if (ready)
      writePersistedState({
        people,
        locations,
        schedules,
        suggestions,
        costPerKm,
      });
  }, [ready, people, locations, schedules, suggestions, costPerKm]);
  useEffect(() => {
    if (!routePlan) return;
    setRoutePlan((current) =>
      current
        ? {
            ...current,
            stops: current.stops.map((stop) => {
              const draft = scheduleDraft.people.find(
                (person) => person.id === stop.id,
              );
              return draft ? { ...stop, address: draft.address } : stop;
            }),
          }
        : current,
    );
  }, [scheduleDraft.people]);
  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(null), 4300);
    return () => window.clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    if (!showPersonForm) {
      setPersonCepState('idle');
      setPersonCepMessage('');
    }
    if (!showLocationForm) {
      setLocationCepState('idle');
      setLocationCepMessage('');
    }
  }, [showPersonForm, showLocationForm]);
  const activePeople = useMemo(
    () => people.filter((person) => person.active),
    [people],
  );
  const activeLocations = useMemo(
    () => locations.filter((location) => location.active),
    [locations],
  );
  const todaySchedules = useMemo(
    () => schedules.filter((schedule) => schedule.date === todayIso()),
    [schedules],
  );
  const visiblePeople = useMemo(
    () =>
      people.filter(
        (person) =>
          `${person.name} ${person.city} ${person.address} ${person.phone}`
            .toLowerCase()
            .includes(personQuery.toLowerCase()) &&
          (personStatus === 'all' ||
            personStatus === (person.active ? 'active' : 'inactive')),
      ),
    [people, personQuery, personStatus],
  );
  const visibleLocations = useMemo(
    () =>
      locations.filter((location) =>
        `${location.name} ${location.city} ${location.address}`
          .toLowerCase()
          .includes(locationQuery.toLowerCase()),
      ),
    [locations, locationQuery],
  );
  const visibleSchedules = useMemo(
    () =>
      schedules
        .filter(
          (schedule) =>
            `${schedule.destinationName} ${schedule.description} ${schedule.people.map((person) => person.label).join(' ')}`
              .toLowerCase()
              .includes(scheduleSearch.toLowerCase()) &&
            (scheduleStatus === 'all' || schedule.status === scheduleStatus),
        )
        .sort((a, b) =>
          `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`),
        ),
    [schedules, scheduleSearch, scheduleStatus],
  );
  const historySchedules = useMemo(
    () =>
      visibleSchedules.filter(
        (schedule) =>
          (!historyStart || schedule.date >= historyStart) &&
          (!historyEnd || schedule.date <= historyEnd),
      ),
    [visibleSchedules, historyStart, historyEnd],
  );
  const operationMarkers = useMemo(
    () =>
      activePeople
        .map((person) => {
          const next = schedules
            .filter(
              (schedule) =>
                schedule.date >= todayIso() &&
                schedule.status !== 'Cancelado' &&
                schedule.people.some(
                  (item) => item.sourcePersonId === person.id,
                ),
            )
            .sort((a, b) =>
              `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`),
            )[0];
          const location = next
            ? (locations.find((item) => item.id === next.locationId) ?? null)
            : null;
          const destination = next ? destinationPoint(location, next) : null;
          const leg = destination
            ? estimateLeg(toPoint(person), destination)
            : null;
          return {
            person,
            next,
            destination,
            leg,
            status: next
              ? ('Programado' as OperationalStatus)
              : person.operationalStatus,
          };
        })
        .filter(
          (marker) =>
            `${marker.person.name} ${marker.person.city} ${marker.person.currentLocation}`
              .toLowerCase()
              .includes(mapSearch.toLowerCase()) &&
            (mapStatus === 'all' || marker.status === mapStatus) &&
            (mapCity === 'all' || marker.person.city === mapCity) &&
            (mapSupervisor === 'all' ||
              marker.person.supervisor === mapSupervisor),
        ),
    [
      activePeople,
      locations,
      mapCity,
      mapSearch,
      mapStatus,
      mapSupervisor,
      schedules,
    ],
  );
  const selectedMarker =
    operationMarkers.find((marker) => marker.person.id === selectedMarkerId) ??
    null;
  function notify(message: string, tone: NonNullable<Toast>['tone'] = 'info') {
    setToast({ message, tone });
  }
  async function lookupPersonCep() {
    const digits = cepDigits(personDraft.cep);
    if (digits.length !== 8) {
      setPersonCepState('error');
      setPersonCepMessage('Digite um CEP com 8 números.');
      return;
    }
    setPersonCepState('loading');
    setPersonCepMessage('Buscando endereço...');
    try {
      const response = await fetch(`https://viacep.com.br/ws/${digits}/json/`, {
        headers: { Accept: 'application/json' },
      });
      if (!response.ok) throw new Error('Falha na consulta');
      const data = (await response.json()) as ViaCepResult;
      if (data.erro) throw new Error('CEP não encontrado');
      setPersonDraft((current) => ({
        ...current,
        cep: formatCep(data.cep || digits),
        address: data.logradouro || current.address,
        neighborhood: data.bairro || current.neighborhood,
        city: data.localidade || current.city,
        uf: data.uf || current.uf,
        complement: data.complemento || current.complement,
      }));
      setPersonCepState('success');
      setPersonCepMessage(
        'Endereço preenchido. Confira e complemente manualmente se precisar.',
      );
    } catch {
      setPersonCepState('error');
      setPersonCepMessage(
        'CEP não encontrado agora. Você pode preencher o endereço manualmente.',
      );
    }
  }
  async function lookupLocationCep() {
    const digits = cepDigits(locationDraft.cep);
    if (digits.length !== 8) {
      setLocationCepState('error');
      setLocationCepMessage('Digite um CEP com 8 números.');
      return;
    }
    setLocationCepState('loading');
    setLocationCepMessage('Buscando endereço...');
    try {
      const response = await fetch(`https://viacep.com.br/ws/${digits}/json/`, {
        headers: { Accept: 'application/json' },
      });
      if (!response.ok) throw new Error('Falha na consulta');
      const data = (await response.json()) as ViaCepResult;
      if (data.erro) throw new Error('CEP não encontrado');
      setLocationDraft((current) => ({
        ...current,
        cep: formatCep(data.cep || digits),
        address: data.logradouro || current.address,
        neighborhood: data.bairro || current.neighborhood,
        city: data.localidade || current.city,
        uf: data.uf || current.uf,
        complement: data.complemento || current.complement,
      }));
      setLocationCepState('success');
      setLocationCepMessage(
        'Endereço preenchido. Confira e complemente manualmente se precisar.',
      );
    } catch {
      setLocationCepState('error');
      setLocationCepMessage(
        'CEP não encontrado agora. Você pode preencher o endereço manualmente.',
      );
    }
  }
  function locateNotice() {
    notify(
      'Localização automática depende de um provedor externo configurado. Informe latitude e longitude para habilitar a rota.',
      'info',
    );
  }
  function navigate(next: View) {
    setView(next);
    setMobileMenu(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  function savePerson() {
    if (
      !personDraft.name.trim() ||
      !personDraft.address.trim() ||
      !personDraft.city.trim()
    )
      return notify(
        'Informe nome, endereço e cidade para salvar a pessoa.',
        'error',
      );
    const record = {
      ...personDraft,
      id: personDraft.id || makeId('person'),
      lastLocationUpdate:
        personDraft.lastLocationUpdate || new Date().toLocaleString('pt-BR'),
    };
    setPeople((current) =>
      current.some((person) => person.id === record.id)
        ? current.map((person) => (person.id === record.id ? record : person))
        : [record, ...current],
    );
    setShowPersonForm(false);
    notify(
      personDraft.id ? 'Pessoa atualizada.' : 'Pessoa cadastrada.',
      'success',
    );
  }
  function saveLocation() {
    if (
      !locationDraft.name.trim() ||
      !locationDraft.address.trim() ||
      !locationDraft.city.trim()
    )
      return notify(
        'Informe nome, endereço e cidade para salvar o local.',
        'error',
      );
    const record = {
      ...locationDraft,
      id: locationDraft.id || makeId('location'),
    };
    setLocations((current) =>
      current.some((location) => location.id === record.id)
        ? current.map((location) =>
            location.id === record.id ? record : location,
          )
        : [record, ...current],
    );
    setShowLocationForm(false);
    notify(
      locationDraft.id ? 'Local atualizado.' : 'Local cadastrado.',
      'success',
    );
  }
  function togglePersonActive(person: Person) {
    setPeople((current) =>
      current.map((item) =>
        item.id === person.id
          ? {
              ...item,
              active: !item.active,
              operationalStatus: !item.active ? 'Disponível' : 'Indisponível',
            }
          : item,
      ),
    );
    notify(
      person.active
        ? 'Pessoa inativada. O histórico foi preservado.'
        : 'Pessoa reativada.',
      'success',
    );
  }
  function startSchedule() {
    const next = emptySchedule();
    const location = activeLocations[0];
    if (location)
      Object.assign(next, {
        locationId: location.id,
        destinationName: location.name,
        destinationAddress: addressOf(location),
        destinationCity: location.city,
        destinationUf: location.uf,
        destinationLat: location.lat,
        destinationLng: location.lng,
      });
    const initialPerson =
      view === 'routes' ? selectedMarker?.person : undefined;
    if (initialPerson) {
      const selected = [snapshot(initialPerson)];
      Object.assign(next, {
        people: selected,
        originalOrder: selected.map((person) => person.id),
      });
    }
    setScheduleDraft(next);
    setRoutePlan(null);
    setRouteDirty(true);
    setIgnoredSuggestion(false);
    navigate('schedule');
  }
  function openSchedule(schedule: Schedule, duplicate = false) {
    const next = duplicate
      ? {
          ...schedule,
          id: makeId('schedule'),
          createdAt: new Date().toISOString(),
          status: 'Rascunho' as ScheduleStatus,
        }
      : { ...schedule };
    setScheduleDraft({
      ...next,
      people: next.people.map((person) => ({ ...person })),
    });
    setRoutePlan(
      next.routeStops.length
        ? {
            stops: next.routeStops,
            totalKm: next.totalKm,
            totalMinutes: next.totalMinutes,
            arrivalTime: next.routeStops[0]?.pickupTime ?? null,
            isApproximate: true,
            notice:
              'Rota carregada do histórico. Recalcule após alterar a ordem.',
          }
        : null,
    );
    setRouteDirty(!next.routeStops.length);
    navigate('schedule');
    if (duplicate) notify('Programação duplicada como rascunho.', 'success');
  }
  function selectDestination(locationId: string) {
    const location = locations.find((item) => item.id === locationId);
    if (!location) return;
    setScheduleDraft((current) => ({
      ...current,
      locationId,
      destinationName: location.name,
      destinationAddress: addressOf(location),
      destinationCity: location.city,
      destinationUf: location.uf,
      destinationLat: location.lat,
      destinationLng: location.lng,
    }));
    setRoutePlan(null);
    setRouteDirty(true);
  }
  function toggleSchedulePerson(person: Person) {
    setScheduleDraft((current) => {
      const exists = current.people.some(
        (item) => item.sourcePersonId === person.id,
      );
      const nextPeople = exists
        ? current.people.filter((item) => item.sourcePersonId !== person.id)
        : [...current.people, snapshot(person)];
      return {
        ...current,
        people: nextPeople,
        originalOrder: nextPeople.map((item) => item.id),
      };
    });
    setRoutePlan(null);
    setRouteDirty(true);
  }
  function selectNearby(person: Person) {
    if (!scheduleDraft.people.some((item) => item.sourcePersonId === person.id))
      toggleSchedulePerson(person);
    setShowNearby(false);
    notify(`${person.name} adicionado à programação.`, 'success');
  }
  function calculateRoute(orderedIds?: string[]) {
    if (
      !scheduleDraft.locationId ||
      !scheduleDraft.date ||
      !scheduleDraft.time ||
      !scheduleDraft.people.length
    )
      return notify(
        'Informe destino, data, horário e pelo menos uma pessoa antes de calcular.',
        'error',
      );
    const plan = buildRoutePlan({
      points: scheduleDraft.people,
      destination: destinationPoint(
        locations.find((item) => item.id === scheduleDraft.locationId) ?? null,
        scheduleDraft,
      ),
      departureTime: scheduleDraft.time,
      arrivalLeadMinutes: scheduleDraft.arrivalLeadMinutes,
      stopBufferMinutes: scheduleDraft.stopBufferMinutes,
      orderedIds,
    });
    setRoutePlan(plan);
    setRouteDirty(false);
    setScheduleDraft((current) => ({
      ...current,
      optimizedOrder: plan.stops.map((stop) => stop.id),
      routeStops: plan.stops,
      totalKm: plan.totalKm,
      totalMinutes: plan.totalMinutes,
    }));
    notify(
      plan.totalKm == null
        ? plan.notice
        : 'Rota recalculada com horários de coleta.',
      plan.totalKm == null ? 'error' : 'success',
    );
  }
  function moveStop(from: number, to: number) {
    if (to < 0 || to >= scheduleDraft.people.length || from === to) return;
    setScheduleDraft((current) => {
      const next = [...current.people];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return { ...current, people: next };
    });
    setRoutePlan(null);
    setRouteDirty(true);
  }
  function saveSchedule() {
    if (
      !scheduleDraft.locationId ||
      !scheduleDraft.date ||
      !scheduleDraft.time ||
      !scheduleDraft.people.length
    )
      return notify(
        'Complete destino, data, horário e pessoas antes de salvar.',
        'error',
      );
    if (routeDirty || !routePlan)
      return notify('Calcule ou otimize a rota antes de salvar.', 'error');
    const record = {
      ...scheduleDraft,
      status: 'Programado' as ScheduleStatus,
      routeStops: routePlan.stops,
      optimizedOrder: routePlan.stops.map((stop) => stop.id),
      totalKm: routePlan.totalKm,
      totalMinutes: routePlan.totalMinutes,
    };
    setSchedules((current) =>
      current.some((item) => item.id === record.id)
        ? current.map((item) => (item.id === record.id ? record : item))
        : [record, ...current],
    );
    setScheduleDraft(record);
    notify('Programação salva e mapa atualizado.', 'success');
  }
  function buildWhatsAppText() {
    if (!scheduleDraft.people.length || !scheduleDraft.destinationName) {
      notify('Adicione destino e pessoas para gerar o texto.', 'error');
      return '';
    }
    const stops =
      routePlan?.stops ??
      scheduleDraft.people.map((person, index) => ({
        ...person,
        order: index + 1,
        distanceKm: null,
        durationMin: null,
        pickupTime: null,
      }));
    const lines = [
      '🚐 *PROGRAMAÇÃO DE EMBARQUE*',
      '',
      `📅 *Data:* ${formatDate(scheduleDraft.date)}`,
      `✈️ *Embarque:* ${scheduleDraft.time}`,
      `📍 *Destino:* ${scheduleDraft.destinationName}`,
      '',
      '*ROTA DE COLETA*',
      '',
    ];
    stops.forEach((stop, index) =>
      lines.push(
        `${index + 1}️⃣ *${stop.label.toUpperCase()}*`,
        `⏰ ${stop.pickupTime ?? 'A confirmar'}`,
        `📍 ${stop.address}`,
        '',
      ),
    );
    lines.push(
      `🏁 *Chegada prevista:* ${routePlan?.arrivalTime ?? scheduleDraft.time}`,
      '',
      `🛣️ Distância estimada: ${formatDistance(routePlan?.totalKm ?? scheduleDraft.totalKm)}`,
      `⏱️ Tempo estimado: ${formatDuration(routePlan?.totalMinutes ?? scheduleDraft.totalMinutes)}`,
      '',
      '⚠️ *Pedimos que todos estejam prontos no horário programado.*',
      '',
      "*IT'S AGRO*",
    );
    return lines.join('\n');
  }
  function copyWhatsApp() {
    const text = buildWhatsAppText();
    if (!text) return;
    navigator.clipboard
      ?.writeText(text)
      .then(() => notify('Texto copiado para o WhatsApp.', 'success'))
      .catch(() => notify('Não foi possível copiar automaticamente.', 'error'));
  }
  function shareWhatsApp() {
    const text = buildWhatsAppText();
    if (!text) return;
    window.open(
      `https://wa.me/?text=${encodeURIComponent(text)}`,
      '_blank',
      'noopener,noreferrer',
    );
    notify('WhatsApp aberto com a mensagem pronta.', 'success');
  }
  function suggestionForSchedule() {
    if (!scheduleDraft.people.length || !scheduleDraft.locationId) return null;
    const destination = destinationPoint(
      locations.find((item) => item.id === scheduleDraft.locationId) ?? null,
      scheduleDraft,
    );
    const selected = scheduleDraft.people
      .map((item) => people.find((person) => person.id === item.sourcePersonId))
      .filter((person): person is Person => Boolean(person));
    const available = activePeople.filter(
      (person) => !selected.some((item) => item.id === person.id),
    );
    const blockedIds = new Set(
      schedules
        .filter(
          (schedule) =>
            schedule.date === scheduleDraft.date &&
            schedule.time !== scheduleDraft.time,
        )
        .flatMap((schedule) =>
          schedule.people.map((item) => item.sourcePersonId),
        ),
    );
    const result = compareCandidateToDestination(
      selected.map((person) => ({
        id: person.id,
        name: person.name,
        point: toPoint(person),
      })),
      available.map((person) => ({
        id: person.id,
        name: person.name,
        point: toPoint(person),
      })),
      destination,
      blockedIds,
    );
    if (!result) return null;
    const original = selected.find(
      (person) => person.id === result.original.id,
    );
    const suggested = available.find(
      (person) => person.id === result.suggested.id,
    );
    if (!original || !suggested) return null;
    return {
      original,
      suggested,
      originalKm: result.originalKm,
      suggestedKm: result.suggestedKm,
      originalMin: result.originalMin,
      suggestedMin: result.suggestedMin,
    };
  }
  function recordSuggestion(
    item: NonNullable<ReturnType<typeof suggestionForSchedule>>,
    decision: 'APLICADA' | 'IGNORADA',
  ) {
    setSuggestions((current) => [
      ...current,
      {
        id: makeId('suggestion'),
        date: new Date().toISOString(),
        scheduleId: scheduleDraft.id,
        originalPerson: item.original.name,
        suggestedPerson: item.suggested.name,
        originalKm: item.originalKm,
        suggestedKm: item.suggestedKm,
        economyKm: Math.max(0, item.originalKm - item.suggestedKm),
        decision,
      },
    ]);
  }
  function applySuggestion(
    item: NonNullable<ReturnType<typeof suggestionForSchedule>>,
  ) {
    setScheduleDraft((current) => ({
      ...current,
      people: current.people.map((person) =>
        person.sourcePersonId === item.original.id
          ? snapshot(item.suggested)
          : person,
      ),
    }));
    setIgnoredSuggestion(true);
    setRoutePlan(null);
    setRouteDirty(true);
    recordSuggestion(item, 'APLICADA');
    notify(
      `Troca aplicada: ${item.suggested.name} entrou no lugar de ${item.original.name}.`,
      'success',
    );
  }
  function openComparison(
    item: NonNullable<ReturnType<typeof suggestionForSchedule>>,
  ) {
    const replacement = scheduleDraft.people.map((person) =>
      person.sourcePersonId === item.original.id
        ? snapshot(item.suggested)
        : person,
    );
    const destination = destinationPoint(
      locations.find((value) => value.id === scheduleDraft.locationId) ?? null,
      scheduleDraft,
    );
    const current = buildRoutePlan({
      points: scheduleDraft.people,
      destination,
      departureTime: scheduleDraft.time,
      arrivalLeadMinutes: scheduleDraft.arrivalLeadMinutes,
      stopBufferMinutes: scheduleDraft.stopBufferMinutes,
    });
    const proposed = buildRoutePlan({
      points: replacement,
      destination,
      departureTime: scheduleDraft.time,
      arrivalLeadMinutes: scheduleDraft.arrivalLeadMinutes,
      stopBufferMinutes: scheduleDraft.stopBufferMinutes,
    });
    setComparison({
      original: item.original,
      suggested: item.suggested,
      originalKm: current.totalKm ?? item.originalKm,
      suggestedKm: proposed.totalKm ?? item.suggestedKm,
      originalMin: current.totalMinutes ?? item.originalMin,
      suggestedMin: proposed.totalMinutes ?? item.suggestedMin,
    });
  }

  function renderPersonEditor() {
    return (
      <section className="card editor-card">
        <div className="card-heading">
          <div>
            <p className="eyebrow">CADASTRO</p>
            <h2>{personDraft.id ? 'Editar pessoa' : 'Nova pessoa'}</h2>
            <p className="section-description">
              A localização atual é independente do cadastro de endereço.
            </p>
          </div>
          <IconButton
            label="Fechar formulário"
            onClick={() => setShowPersonForm(false)}
          >
            <X size={18} />
          </IconButton>
        </div>
        <div className="form-grid">
          <Field label="Nome completo" className="span-2">
            <input
              value={personDraft.name}
              onChange={(event) =>
                setPersonDraft({ ...personDraft, name: event.target.value })
              }
            />
          </Field>
          <Field label="Telefone / WhatsApp">
            <input
              value={personDraft.phone}
              onChange={(event) =>
                setPersonDraft({ ...personDraft, phone: event.target.value })
              }
            />
          </Field>
          <Field label="CPF (opcional)">
            <input
              value={personDraft.cpf}
              onChange={(event) =>
                setPersonDraft({ ...personDraft, cpf: event.target.value })
              }
            />
          </Field>
          <Field label="Cidade">
            <input
              value={personDraft.city}
              onChange={(event) =>
                setPersonDraft({ ...personDraft, city: event.target.value })
              }
            />
          </Field>
          <Field label="UF">
            <input
              maxLength={2}
              value={personDraft.uf}
              onChange={(event) =>
                setPersonDraft({
                  ...personDraft,
                  uf: event.target.value.toUpperCase(),
                })
              }
            />
          </Field>
          <Field label="Endereço" className="span-2">
            <input
              value={personDraft.address}
              onChange={(event) =>
                setPersonDraft({ ...personDraft, address: event.target.value })
              }
            />
          </Field>
          <Field label="Número">
            <input
              value={personDraft.number}
              onChange={(event) =>
                setPersonDraft({ ...personDraft, number: event.target.value })
              }
            />
          </Field>
          <Field label="Bairro">
            <input
              value={personDraft.neighborhood}
              onChange={(event) =>
                setPersonDraft({
                  ...personDraft,
                  neighborhood: event.target.value,
                })
              }
            />
          </Field>
          <Field
            label="CEP"
            className="span-2"
            hint="Digite manualmente ou busque o endereço pelo CEP."
          >
            <div className="field-action">
              <input
                inputMode="numeric"
                maxLength={9}
                placeholder="00000-000"
                value={personDraft.cep}
                onChange={(event) => {
                  setPersonCepState('idle');
                  setPersonCepMessage('');
                  setPersonDraft({
                    ...personDraft,
                    cep: formatCep(event.target.value),
                  });
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    void lookupPersonCep();
                  }
                }}
              />
              <button
                type="button"
                className="button button-secondary"
                onClick={() => void lookupPersonCep()}
                disabled={personCepState === 'loading'}
              >
                <Search size={14} />
                {personCepState === 'loading' ? 'Buscando...' : 'Buscar CEP'}
              </button>
            </div>
            {personCepMessage && (
              <small
                className={`cep-feedback ${personCepState}`}
                aria-live="polite"
              >
                {personCepMessage}
              </small>
            )}
          </Field>
          <Field label="Complemento">
            <input
              value={personDraft.complement}
              onChange={(event) =>
                setPersonDraft({
                  ...personDraft,
                  complement: event.target.value,
                })
              }
            />
          </Field>
          <Field label="Ponto de referência" className="span-2">
            <input
              value={personDraft.reference}
              onChange={(event) =>
                setPersonDraft({
                  ...personDraft,
                  reference: event.target.value,
                })
              }
            />
          </Field>
          <Field label="Local atual" className="span-2">
            <input
              value={personDraft.currentLocation}
              onChange={(event) =>
                setPersonDraft({
                  ...personDraft,
                  currentLocation: event.target.value,
                })
              }
              placeholder="Londrina - PR"
            />
          </Field>
          <Field label="Supervisor">
            <input
              value={personDraft.supervisor}
              onChange={(event) =>
                setPersonDraft({
                  ...personDraft,
                  supervisor: event.target.value,
                })
              }
            />
          </Field>
          <Field label="Status operacional">
            <select
              value={personDraft.operationalStatus}
              onChange={(event) =>
                setPersonDraft({
                  ...personDraft,
                  operationalStatus: event.target.value as OperationalStatus,
                })
              }
            >
              {OPERATIONAL_STATUSES.map((status) => (
                <option key={status}>{status}</option>
              ))}
            </select>
          </Field>
          <Field label="Latitude" hint="Necessária para rota">
            <input
              inputMode="decimal"
              value={personDraft.lat ?? ''}
              onChange={(event) =>
                setPersonDraft({
                  ...personDraft,
                  lat: toNumber(event.target.value),
                })
              }
            />
          </Field>
          <Field label="Longitude" hint="Necessária para rota">
            <input
              inputMode="decimal"
              value={personDraft.lng ?? ''}
              onChange={(event) =>
                setPersonDraft({
                  ...personDraft,
                  lng: toNumber(event.target.value),
                })
              }
            />
          </Field>
          <Field label="Observação" className="span-2">
            <textarea
              rows={3}
              value={personDraft.notes}
              onChange={(event) =>
                setPersonDraft({ ...personDraft, notes: event.target.value })
              }
            />
          </Field>
        </div>
        <div className="location-helper">
          <div>
            <LocateFixed size={18} />
            <span>
              <strong>Geocodificação preparada</strong>
              <small>
                Sem provedor externo, o sistema não inventa coordenadas.
              </small>
            </span>
          </div>
          <button
            type="button"
            className="button button-ghost"
            onClick={locateNotice}
          >
            Localizar endereço
          </button>
        </div>
        <div className="editor-actions">
          <button
            type="button"
            className="button button-secondary"
            onClick={() => setShowPersonForm(false)}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="button button-primary"
            onClick={savePerson}
          >
            <Check size={16} /> Salvar pessoa
          </button>
        </div>
      </section>
    );
  }
  function renderLocationEditor() {
    return (
      <section className="card editor-card">
        <div className="card-heading">
          <div>
            <p className="eyebrow">DESTINO</p>
            <h2>
              {locationDraft.id ? 'Editar local' : 'Novo local de embarque'}
            </h2>
            <p className="section-description">
              O local salvo pode ser reutilizado nas próximas programações.
            </p>
          </div>
          <IconButton
            label="Fechar formulário"
            onClick={() => setShowLocationForm(false)}
          >
            <X size={18} />
          </IconButton>
        </div>
        <div className="form-grid">
          <Field label="Nome do local" className="span-2">
            <input
              value={locationDraft.name}
              onChange={(event) =>
                setLocationDraft({ ...locationDraft, name: event.target.value })
              }
            />
          </Field>
          <Field label="Tipo">
            <select
              value={locationDraft.type}
              onChange={(event) =>
                setLocationDraft({ ...locationDraft, type: event.target.value })
              }
            >
              {LOCATION_TYPES.map((type) => (
                <option key={type}>{type}</option>
              ))}
            </select>
          </Field>
          <Field label="Cidade">
            <input
              value={locationDraft.city}
              onChange={(event) =>
                setLocationDraft({ ...locationDraft, city: event.target.value })
              }
            />
          </Field>
          <Field label="UF">
            <input
              maxLength={2}
              value={locationDraft.uf}
              onChange={(event) =>
                setLocationDraft({
                  ...locationDraft,
                  uf: event.target.value.toUpperCase(),
                })
              }
            />
          </Field>
          <Field label="Endereço" className="span-2">
            <input
              value={locationDraft.address}
              onChange={(event) =>
                setLocationDraft({
                  ...locationDraft,
                  address: event.target.value,
                })
              }
            />
          </Field>
          <Field label="Número">
            <input
              value={locationDraft.number}
              onChange={(event) =>
                setLocationDraft({
                  ...locationDraft,
                  number: event.target.value,
                })
              }
            />
          </Field>
          <Field label="Bairro">
            <input
              value={locationDraft.neighborhood}
              onChange={(event) =>
                setLocationDraft({
                  ...locationDraft,
                  neighborhood: event.target.value,
                })
              }
            />
          </Field>
          <Field
            label="CEP"
            className="span-2"
            hint="Digite manualmente ou busque o endereço pelo CEP."
          >
            <div className="field-action">
              <input
                inputMode="numeric"
                maxLength={9}
                placeholder="00000-000"
                value={locationDraft.cep}
                onChange={(event) => {
                  setLocationCepState('idle');
                  setLocationCepMessage('');
                  setLocationDraft({
                    ...locationDraft,
                    cep: formatCep(event.target.value),
                  });
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    void lookupLocationCep();
                  }
                }}
              />
              <button
                type="button"
                className="button button-secondary"
                onClick={() => void lookupLocationCep()}
                disabled={locationCepState === 'loading'}
              >
                <Search size={14} />
                {locationCepState === 'loading' ? 'Buscando...' : 'Buscar CEP'}
              </button>
            </div>
            {locationCepMessage && (
              <small
                className={`cep-feedback ${locationCepState}`}
                aria-live="polite"
              >
                {locationCepMessage}
              </small>
            )}
          </Field>
          <Field label="Complemento">
            <input
              value={locationDraft.complement}
              onChange={(event) =>
                setLocationDraft({
                  ...locationDraft,
                  complement: event.target.value,
                })
              }
            />
          </Field>
          <Field label="Latitude" hint="Necessária para a rota">
            <input
              inputMode="decimal"
              value={locationDraft.lat ?? ''}
              onChange={(event) =>
                setLocationDraft({
                  ...locationDraft,
                  lat: toNumber(event.target.value),
                })
              }
            />
          </Field>
          <Field label="Longitude" hint="Necessária para a rota">
            <input
              inputMode="decimal"
              value={locationDraft.lng ?? ''}
              onChange={(event) =>
                setLocationDraft({
                  ...locationDraft,
                  lng: toNumber(event.target.value),
                })
              }
            />
          </Field>
          <Field label="Observação" className="span-2">
            <textarea
              rows={3}
              value={locationDraft.notes}
              onChange={(event) =>
                setLocationDraft({
                  ...locationDraft,
                  notes: event.target.value,
                })
              }
            />
          </Field>
        </div>
        <div className="location-helper">
          <div>
            <MapPin size={18} />
            <span>
              <strong>Localização no mapa</strong>
              <small>
                Informe coordenadas para posicionar o local sem depender de uma
                API.
              </small>
            </span>
          </div>
          <button
            type="button"
            className="button button-ghost"
            onClick={locateNotice}
          >
            Localizar endereço
          </button>
        </div>
        <div className="editor-actions">
          <button
            type="button"
            className="button button-secondary"
            onClick={() => setShowLocationForm(false)}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="button button-primary"
            onClick={saveLocation}
          >
            <Check size={16} /> Salvar local
          </button>
        </div>
      </section>
    );
  }

  function renderDashboard() {
    const upcoming = schedules
      .filter(
        (schedule) =>
          schedule.date >= todayIso() && schedule.status !== 'Cancelado',
      )
      .sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`))
      .slice(0, 5);
    const programmedKm = schedules.reduce(
      (total, schedule) => total + (schedule.totalKm ?? 0),
      0,
    );
    const savedKm = suggestions
      .filter((item) => item.decision === 'APLICADA')
      .reduce((total, item) => total + item.economyKm, 0);
    return (
      <>
        <section className="dashboard-hero">
          <div>
            <p className="eyebrow">
              CENTRO DE OPERAÇÃO ·{' '}
              {new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long' }).format(
                new Date(),
              )}
            </p>
            <h1>Programação de embarque</h1>
            <p>
              Organize pessoas, destinos e rotas em uma única visão operacional.
            </p>
          </div>
          <button
            type="button"
            className="button button-primary button-large"
            onClick={startSchedule}
          >
            <Plus size={18} /> Nova programação
          </button>
        </section>
        <section className="metrics-grid">
          <Metric
            icon={UsersRound}
            label="Pessoas cadastradas"
            value={activePeople.length}
            detail={`${people.length - activePeople.length} inativa(s)`}
            tone="olive"
          />
          <Metric
            icon={MapPin}
            label="Locais cadastrados"
            value={activeLocations.length}
            detail="destinos ativos"
            tone="mint"
          />
          <Metric
            icon={CalendarDays}
            label="Programações de hoje"
            value={todaySchedules.length}
            detail="agenda operacional"
            tone="gold"
          />
          <Metric
            icon={UserCheck}
            label="Pessoas programadas"
            value={todaySchedules.reduce(
              (total, schedule) => total + schedule.people.length,
              0,
            )}
            detail="embarques de hoje"
            tone="yellow"
          />
          <Metric
            icon={RouteIcon}
            label="Rotas geradas"
            value={
              schedules.filter((schedule) => schedule.routeStops.length).length
            }
            detail="com planejamento salvo"
            tone="cream"
          />
        </section>
        <section className="intelligence-grid">
          <Metric
            icon={BarChart3}
            label="KM programados"
            value={formatDistance(programmedKm)}
            detail="rotas salvas"
            tone="cream"
          />
          <Metric
            icon={ArrowDown}
            label="KM evitados"
            value={formatDistance(savedKm)}
            detail="por troca aplicada"
            tone="mint"
          />
          <Metric
            icon={Sparkles}
            label="Economia estimada"
            value={`R$ ${(savedKm * costPerKm).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
            detail={`custo configurado: R$ ${costPerKm.toFixed(2)}/km`}
            tone="gold"
          />
          <Metric
            icon={RefreshCw}
            label="Sugestões geradas"
            value={suggestions.length}
            detail={`${suggestions.filter((item) => item.decision === 'APLICADA').length} aceita(s)`}
            tone="olive"
          />
        </section>
        <div className="dashboard-grid">
          <section className="card upcoming-card">
            <div className="card-heading">
              <div>
                <p className="eyebrow">AGENDA</p>
                <h2>Próximos embarques</h2>
              </div>
              <button
                type="button"
                className="text-button"
                onClick={() => navigate('history')}
              >
                Ver histórico <ArrowRight size={15} />
              </button>
            </div>
            {upcoming.length ? (
              <div className="upcoming-list">
                {upcoming.map((schedule) => (
                  <button
                    type="button"
                    className="upcoming-row"
                    key={schedule.id}
                    onClick={() => openSchedule(schedule)}
                  >
                    <span className="date-block">
                      <strong>
                        {new Date(`${schedule.date}T12:00:00`).getDate()}
                      </strong>
                      <small>
                        {new Intl.DateTimeFormat('pt-BR', { month: 'short' })
                          .format(new Date(`${schedule.date}T12:00:00`))
                          .replace('.', '')}
                      </small>
                    </span>
                    <span className="upcoming-main">
                      <strong>{schedule.destinationName}</strong>
                      <small>
                        <Clock3 size={13} /> {schedule.time} ·{' '}
                        {schedule.people.length} pessoa(s)
                      </small>
                    </span>
                    <Badge tone={cssStatus(schedule.status)}>
                      {schedule.status}
                    </Badge>
                    <ChevronRight size={17} />
                  </button>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={CalendarDays}
                title="Nenhum embarque programado"
                text="Crie uma programação para começar."
                action={
                  <button
                    type="button"
                    className="button button-secondary"
                    onClick={startSchedule}
                  >
                    <Plus size={16} /> Nova programação
                  </button>
                }
              />
            )}
          </section>
          <section className="card focus-card">
            <div className="focus-top">
              <span className="focus-icon">
                <Sparkles size={18} />
              </span>
              <Badge tone="live">AO VIVO</Badge>
            </div>
            <p className="eyebrow">FOCO DA OPERAÇÃO</p>
            <h2>
              {todaySchedules.length
                ? `${todaySchedules.length} embarque(s) na agenda`
                : 'Prepare o próximo embarque'}
            </h2>
            <p>
              {todaySchedules.length
                ? 'Confira as rotas salvas e mantenha a equipe alinhada antes da saída.'
                : 'Defina destino, horário e pessoas. O sistema calcula sequência e coleta.'}
            </p>
            <button
              type="button"
              className="button button-dark"
              onClick={
                todaySchedules.length
                  ? () => openSchedule(todaySchedules[0])
                  : startSchedule
              }
            >
              {todaySchedules.length ? 'Abrir programação' : 'Começar agora'}{' '}
              <ArrowRight size={16} />
            </button>
          </section>
        </div>
        <section className="card decision-card">
          <div className="card-heading">
            <div>
              <p className="eyebrow">DECISÃO LOGÍSTICA</p>
              <h2>Mapa da operação</h2>
              <p className="section-description">
                Veja onde cada classificador está e para onde deve ir.
              </p>
            </div>
            <button
              type="button"
              className="button button-secondary"
              onClick={() => navigate('routes')}
            >
              <MapIcon size={16} /> Abrir mapa
            </button>
          </div>
          <div className="decision-summary">
            <div>
              <strong>
                {
                  operationMarkers.filter(
                    (marker) => marker.status === 'Programado',
                  ).length
                }
              </strong>
              <span>programados</span>
            </div>
            <div>
              <strong>
                {
                  operationMarkers.filter(
                    (marker) => marker.status === 'Disponível',
                  ).length
                }
              </strong>
              <span>disponíveis</span>
            </div>
            <div>
              <strong>
                {
                  operationMarkers.filter(
                    (marker) => marker.leg && marker.leg.distanceKm > 180,
                  ).length
                }
              </strong>
              <span>deslocamentos longos</span>
            </div>
            <div className="decision-note">
              <AlertTriangle size={17} />
              <span>Compare alternativas antes de confirmar uma rota.</span>
            </div>
          </div>
        </section>
      </>
    );
  }

  function renderPeoplePage() {
    return (
      <>
        <SectionTitle
          eyebrow="CADASTRO DE PESSOAS"
          title="Pessoas"
          text={`${activePeople.length} pessoas ativas para a operação.`}
          action={
            <button
              type="button"
              className="button button-primary"
              onClick={() => {
                setPersonDraft(emptyPerson());
                setShowPersonForm(true);
              }}
            >
              <Plus size={17} /> Nova pessoa
            </button>
          }
        />
        {showPersonForm && renderPersonEditor()}
        <section className="card table-card">
          <div className="toolbar">
            <div className="search-box">
              <Search size={17} />
              <input
                value={personQuery}
                onChange={(event) => setPersonQuery(event.target.value)}
                placeholder="Buscar por nome, cidade, endereço..."
              />
            </div>
            <div className="toolbar-filters">
              <select
                value={personStatus}
                onChange={(event) => setPersonStatus(event.target.value)}
              >
                <option value="all">Todos os status</option>
                <option value="active">Ativas</option>
                <option value="inactive">Inativas</option>
              </select>
              <span className="result-count">
                {visiblePeople.length} registro(s)
              </span>
            </div>
          </div>
          {visiblePeople.length ? (
            <>
              <div className="responsive-table">
                <table>
                  <thead>
                    <tr>
                      <th>Nome</th>
                      <th>Local atual</th>
                      <th>Endereço</th>
                      <th>Telefone</th>
                      <th>Status</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {visiblePeople.map((person) => (
                      <tr key={person.id}>
                        <td>
                          <div className="person-cell">
                            <span className="avatar">
                              {person.name
                                .split(' ')
                                .slice(0, 2)
                                .map((part) => part[0])
                                .join('')}
                            </span>
                            <span>
                              <strong>{person.name}</strong>
                              <small>
                                {person.supervisor || 'Sem supervisor'}
                              </small>
                            </span>
                          </div>
                        </td>
                        <td>
                          {person.currentLocation ||
                            `${person.city}/${person.uf}`}
                          <small className="table-subtext">
                            Atualizado {person.lastLocationUpdate || '—'}
                          </small>
                        </td>
                        <td>{addressOf(person)}</td>
                        <td>
                          <a
                            className="phone-link"
                            href={`tel:${person.phone}`}
                          >
                            <Phone size={14} /> {person.phone || '—'}
                          </a>
                        </td>
                        <td>
                          <Badge tone={person.active ? 'active' : 'inactive'}>
                            {person.active ? 'Ativo' : 'Inativo'}
                          </Badge>
                        </td>
                        <td>
                          <div className="row-actions">
                            <IconButton
                              label="Editar pessoa"
                              onClick={() => {
                                setPersonDraft({ ...person });
                                setShowPersonForm(true);
                              }}
                            >
                              <Pencil size={16} />
                            </IconButton>
                            <IconButton
                              label={
                                person.active
                                  ? 'Inativar pessoa'
                                  : 'Reativar pessoa'
                              }
                              onClick={() => togglePersonActive(person)}
                            >
                              {person.active ? (
                                <UserX size={16} />
                              ) : (
                                <UserCheck size={16} />
                              )}
                            </IconButton>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mobile-records">
                {visiblePeople.map((person) => (
                  <article className="mobile-record" key={person.id}>
                    <div className="mobile-record-top">
                      <div className="person-cell">
                        <span className="avatar">
                          {person.name
                            .split(' ')
                            .slice(0, 2)
                            .map((part) => part[0])
                            .join('')}
                        </span>
                        <span>
                          <strong>{person.name}</strong>
                          <small>
                            {person.currentLocation ||
                              `${person.city}/${person.uf}`}
                          </small>
                        </span>
                      </div>
                      <Badge tone={person.active ? 'active' : 'inactive'}>
                        {person.active ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </div>
                    <p>{addressOf(person)}</p>
                    <div className="mobile-record-bottom">
                      <span className="phone-link">
                        <Phone size={14} /> {person.phone || 'Sem telefone'}
                      </span>
                      <div className="row-actions">
                        <IconButton
                          label="Editar"
                          onClick={() => {
                            setPersonDraft({ ...person });
                            setShowPersonForm(true);
                          }}
                        >
                          <Pencil size={16} />
                        </IconButton>
                        <IconButton
                          label="Inativar ou reativar"
                          onClick={() => togglePersonActive(person)}
                        >
                          {person.active ? (
                            <UserX size={16} />
                          ) : (
                            <UserCheck size={16} />
                          )}
                        </IconButton>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </>
          ) : (
            <EmptyState
              icon={UsersRound}
              title="Nenhuma pessoa encontrada"
              text="Cadastre a primeira pessoa ou ajuste a busca."
              action={
                <button
                  type="button"
                  className="button button-secondary"
                  onClick={() => {
                    setPersonDraft(emptyPerson());
                    setShowPersonForm(true);
                  }}
                >
                  <Plus size={16} /> Cadastrar pessoa
                </button>
              }
            />
          )}
        </section>
      </>
    );
  }

  function renderLocationsPage() {
    return (
      <>
        <SectionTitle
          eyebrow="DESTINOS E PONTOS DE ENCONTRO"
          title="Locais de embarque"
          text={`${activeLocations.length} locais ativos disponíveis.`}
          action={
            <button
              type="button"
              className="button button-primary"
              onClick={() => {
                setLocationDraft(emptyLocation());
                setShowLocationForm(true);
              }}
            >
              <Plus size={17} /> Novo local
            </button>
          }
        />
        {showLocationForm && renderLocationEditor()}
        <section className="card table-card">
          <div className="toolbar">
            <div className="search-box">
              <Search size={17} />
              <input
                value={locationQuery}
                onChange={(event) => setLocationQuery(event.target.value)}
                placeholder="Buscar local, cidade ou endereço..."
              />
            </div>
            <span className="result-count">
              {visibleLocations.length} registro(s)
            </span>
          </div>
          {visibleLocations.length ? (
            <div className="location-cards">
              {visibleLocations.map((location) => (
                <article className="location-card" key={location.id}>
                  <div className="location-card-icon">
                    <MapPin size={19} />
                  </div>
                  <div className="location-card-content">
                    <div className="location-card-head">
                      <div>
                        <Badge tone="olive">{location.type}</Badge>
                        <h3>{location.name}</h3>
                      </div>
                      <Badge tone={location.active ? 'active' : 'inactive'}>
                        {location.active ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </div>
                    <p>{addressOf(location)}</p>
                    <div className="location-meta">
                      <span>
                        {location.lat != null && location.lng != null ? (
                          <>
                            <LocateFixed size={14} /> Coordenadas salvas
                          </>
                        ) : (
                          <>
                            <AlertTriangle size={14} /> Sem coordenadas
                          </>
                        )}
                      </span>
                      <span>
                        <Layers3 size={14} /> Reutilizável
                      </span>
                    </div>
                    <div className="location-card-actions">
                      <button
                        type="button"
                        className="button button-ghost"
                        onClick={() => {
                          if (location.lat != null && location.lng != null) {
                            notify(
                              'Local pronto para visualização no mapa.',
                              'success',
                            );
                            navigate('routes');
                          } else locateNotice();
                        }}
                      >
                        <Eye size={15} /> Ver no mapa
                      </button>
                      <button
                        type="button"
                        className="button button-ghost"
                        onClick={() => {
                          setLocationDraft({ ...location });
                          setShowLocationForm(true);
                        }}
                      >
                        <Pencil size={15} /> Editar
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={MapPin}
              title="Nenhum local encontrado"
              text="Cadastre destinos para agilizar as próximas programações."
              action={
                <button
                  type="button"
                  className="button button-secondary"
                  onClick={() => {
                    setLocationDraft(emptyLocation());
                    setShowLocationForm(true);
                  }}
                >
                  <Plus size={16} /> Cadastrar local
                </button>
              }
            />
          )}
        </section>
      </>
    );
  }

  function renderNearbyPanel() {
    const destination = locations.find(
      (location) => location.id === scheduleDraft.locationId,
    );
    const dest = destination
      ? destinationPoint(destination, scheduleDraft)
      : null;
    const ranked = dest
      ? activePeople
          .map((person) => ({
            person,
            leg: estimateLeg(toPoint(person), dest),
          }))
          .filter((item) => item.leg)
          .sort(
            (a, b) =>
              (a.leg?.distanceKm ?? Infinity) - (b.leg?.distanceKm ?? Infinity),
          )
      : [];
    return (
      <section className="nearby-panel">
        <div className="nearby-header">
          <div>
            <p className="eyebrow">RANKING LOGÍSTICO</p>
            <h3>Classificadores mais próximos</h3>
            <p>
              Compare distância e tempo até{' '}
              {scheduleDraft.destinationName || 'o destino'}.
            </p>
          </div>
          <IconButton
            label="Fechar ranking"
            onClick={() => setShowNearby(false)}
          >
            <X size={17} />
          </IconButton>
        </div>
        {ranked.length ? (
          <div className="ranking-list">
            {ranked.map(({ person, leg }, index) => (
              <div className="ranking-row" key={person.id}>
                <span className={`rank-number rank-${index + 1}`}>
                  {index + 1}
                </span>
                <div className="ranking-person">
                  <strong>{person.name}</strong>
                  <small>
                    {person.currentLocation || `${person.city}/${person.uf}`}
                  </small>
                </div>
                <div className="ranking-distance">
                  <strong>{formatDistance(leg?.distanceKm ?? null)}</strong>
                  <small>{formatDuration(leg?.durationMin ?? null)}</small>
                </div>
                <button
                  type="button"
                  className="button button-small button-secondary"
                  onClick={() => selectNearby(person)}
                >
                  {scheduleDraft.people.some(
                    (item) => item.sourcePersonId === person.id,
                  )
                    ? 'Selecionado'
                    : 'Selecionar'}
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="inline-notice">
            <AlertTriangle size={17} /> Informe coordenadas para gerar o
            ranking.
          </div>
        )}
      </section>
    );
  }
  function renderScheduleAlerts() {
    const suggestion = suggestionForSchedule();
    return (
      <>
        {suggestion && !ignoredSuggestion && (
          <section className="suggestion-card">
            <div className="suggestion-icon">
              <Sparkles size={20} />
            </div>
            <div className="suggestion-body">
              <p className="eyebrow">SUGESTÃO LOGÍSTICA</p>
              <h3>Encontramos uma opção melhor</h3>
              <p>
                Trocar <strong>{suggestion.original.name}</strong> por{' '}
                <strong>{suggestion.suggested.name}</strong> pode reduzir o
                deslocamento.
              </p>
              <div className="suggestion-metrics">
                <span>
                  ↓{' '}
                  {formatDistance(
                    suggestion.originalKm - suggestion.suggestedKm,
                  )}
                </span>
                <span>
                  ⏱{' '}
                  {formatDuration(
                    Math.max(
                      0,
                      suggestion.originalMin - suggestion.suggestedMin,
                    ),
                  )}
                </span>
                <span>
                  💰 R${' '}
                  {(
                    (suggestion.originalKm - suggestion.suggestedKm) *
                    costPerKm
                  ).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="suggestion-actions">
                <button
                  type="button"
                  className="button button-ghost"
                  onClick={() => openComparison(suggestion)}
                >
                  Ver comparação
                </button>
                <button
                  type="button"
                  className="button button-primary"
                  onClick={() => applySuggestion(suggestion)}
                >
                  Aplicar troca
                </button>
                <button
                  type="button"
                  className="text-button"
                  onClick={() => {
                    setIgnoredSuggestion(true);
                    recordSuggestion(suggestion, 'IGNORADA');
                  }}
                >
                  Ignorar
                </button>
              </div>
            </div>
          </section>
        )}
        {!suggestion && scheduleDraft.people.length > 0 && (
          <div className="alert-strip good">
            <CircleCheck size={17} />
            <span>
              <strong>Sem alternativa claramente melhor</strong>
              <small>
                A seleção atual não apresentou uma troca com economia
                suficiente.
              </small>
            </span>
          </div>
        )}
      </>
    );
  }
  function renderSchedulePage() {
    const selected = new Set(
      scheduleDraft.people.map((person) => person.sourcePersonId),
    );
    const picker = activePeople.filter((person) =>
      `${person.name} ${person.city}`
        .toLowerCase()
        .includes(personPickerQuery.toLowerCase()),
    );
    const routePoints =
      routePlan?.stops ??
      scheduleDraft.people.map((person, index) => ({
        ...person,
        order: index + 1,
        distanceKm: null,
        durationMin: null,
        pickupTime: null,
      }));
    const destination =
      locations.find((location) => location.id === scheduleDraft.locationId) ??
      null;
    const dest = destination
      ? destinationPoint(destination, scheduleDraft)
      : null;
    const missing =
      scheduleDraft.people.filter(
        (person) => person.lat == null || person.lng == null,
      ).length + (dest && (dest.lat == null || dest.lng == null) ? 1 : 0);
    return (
      <>
        <SectionTitle
          eyebrow={
            scheduleDraft.status === 'Rascunho'
              ? 'NOVA PROGRAMAÇÃO'
              : 'PROGRAMAÇÃO SALVA'
          }
          title="Programação de embarque"
          text={`${longDate(scheduleDraft.date)} · saída prevista às ${scheduleDraft.time}`}
          action={
            <div className="title-actions">
              <button
                type="button"
                className="button button-secondary"
                onClick={() => navigate('dashboard')}
              >
                <ArrowLeft size={16} /> Voltar
              </button>
              <button
                type="button"
                className="button button-primary"
                onClick={saveSchedule}
              >
                <ShieldCheck size={16} /> Salvar programação
              </button>
            </div>
          }
        />
        <section className="schedule-layout">
          <div className="schedule-main">
            <section className="card schedule-config">
              <div className="card-heading">
                <div>
                  <p className="eyebrow">01 · DADOS DO EMBARQUE</p>
                  <h2>Defina o próximo embarque</h2>
                </div>
                <Badge tone={cssStatus(scheduleDraft.status)}>
                  {scheduleDraft.status}
                </Badge>
              </div>
              <div className="form-grid">
                <Field label="Data">
                  <input
                    type="date"
                    value={scheduleDraft.date}
                    onChange={(event) => {
                      setScheduleDraft({
                        ...scheduleDraft,
                        date: event.target.value,
                      });
                      setRouteDirty(true);
                    }}
                  />
                </Field>
                <Field label="Horário previsto">
                  <input
                    type="time"
                    value={scheduleDraft.time}
                    onChange={(event) => {
                      setScheduleDraft({
                        ...scheduleDraft,
                        time: event.target.value,
                      });
                      setRouteDirty(true);
                    }}
                  />
                </Field>
                <Field label="Destino" className="span-2">
                  <select
                    value={scheduleDraft.locationId}
                    onChange={(event) => selectDestination(event.target.value)}
                  >
                    <option value="">Selecione o destino</option>
                    {activeLocations.map((location) => (
                      <option key={location.id} value={location.id}>
                        {location.name} · {location.city}/{location.uf}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Descrição" className="span-2">
                  <input
                    value={scheduleDraft.description}
                    onChange={(event) =>
                      setScheduleDraft({
                        ...scheduleDraft,
                        description: event.target.value,
                      })
                    }
                    placeholder="Ex.: Embarque equipe comercial"
                  />
                </Field>
                <Field label="Observações" className="span-2">
                  <textarea
                    rows={2}
                    value={scheduleDraft.notes}
                    onChange={(event) =>
                      setScheduleDraft({
                        ...scheduleDraft,
                        notes: event.target.value,
                      })
                    }
                  />
                </Field>
              </div>
              <div className="config-strip">
                <div>
                  <Clock3 size={17} />
                  <span>
                    <strong>Chegada desejada</strong>
                    <small>
                      {routePlan?.arrivalTime ?? '—'} ·{' '}
                      {scheduleDraft.arrivalLeadMinutes} min antes do embarque
                    </small>
                  </span>
                </div>
                <Field label="Antecedência de chegada">
                  <input
                    type="number"
                    min={0}
                    max={180}
                    value={scheduleDraft.arrivalLeadMinutes}
                    onChange={(event) => {
                      setScheduleDraft({
                        ...scheduleDraft,
                        arrivalLeadMinutes: Number(event.target.value),
                      });
                      setRouteDirty(true);
                    }}
                  />
                </Field>
                <Field label="Margem por parada">
                  <input
                    type="number"
                    min={0}
                    max={60}
                    value={scheduleDraft.stopBufferMinutes}
                    onChange={(event) => {
                      setScheduleDraft({
                        ...scheduleDraft,
                        stopBufferMinutes: Number(event.target.value),
                      });
                      setRouteDirty(true);
                    }}
                  />
                </Field>
              </div>
            </section>
            <section className="card schedule-config">
              <div className="card-heading">
                <div>
                  <p className="eyebrow">02 · CLASSIFICADORES</p>
                  <h2>Quem precisa embarcar?</h2>
                  <p className="section-description">
                    Selecione pessoas ativas. Ajustes de endereço ficam só nesta
                    programação.
                  </p>
                </div>
                <span className="count-pill">
                  {scheduleDraft.people.length} selecionada(s)
                </span>
              </div>
              <div className="selection-actions">
                <button
                  type="button"
                  className="button button-secondary"
                  onClick={() => setShowNearby((current) => !current)}
                >
                  <Crosshair size={17} /> Ver mais próximos
                </button>
                <button
                  type="button"
                  className="button button-ghost"
                  onClick={() => navigate('routes')}
                >
                  <MapIcon size={16} /> Ver no mapa
                </button>
              </div>
              {showNearby && renderNearbyPanel()}
              <div className="picker-toolbar">
                <div className="search-box">
                  <Search size={16} />
                  <input
                    value={personPickerQuery}
                    onChange={(event) =>
                      setPersonPickerQuery(event.target.value)
                    }
                    placeholder="Buscar pessoa ou cidade..."
                  />
                </div>
                <span className="picker-hint">
                  <Check size={14} /> Selecionadas ficam na programação
                </span>
              </div>
              <div className="person-picker">
                {picker.length ? (
                  picker.map((person) => (
                    <label
                      className={`picker-person ${selected.has(person.id) ? 'selected' : ''}`}
                      key={person.id}
                    >
                      <input
                        type="checkbox"
                        checked={selected.has(person.id)}
                        onChange={() => toggleSchedulePerson(person)}
                      />
                      <span className="checkbox-mark">
                        <Check size={14} />
                      </span>
                      <span className="picker-person-main">
                        <strong>{person.name}</strong>
                        <small>
                          {person.currentLocation ||
                            `${person.city}/${person.uf}`}{' '}
                          · {person.phone || 'sem WhatsApp'}
                        </small>
                      </span>
                      {selected.has(person.id) && (
                        <Badge tone="olive">Na rota</Badge>
                      )}
                    </label>
                  ))
                ) : (
                  <div className="inline-notice">
                    Nenhuma pessoa ativa encontrada.
                  </div>
                )}
              </div>
            </section>
            <section className="card route-card">
              <div className="card-heading">
                <div>
                  <p className="eyebrow">03 · ROTA E HORÁRIOS</p>
                  <h2>Rota otimizada</h2>
                  <p className="section-description">
                    A sequência considera as pernas entre pontos e mantém o
                    destino como parada final.
                  </p>
                </div>
                <div className="route-actions">
                  <button
                    type="button"
                    className="button button-primary button-large"
                    onClick={() => calculateRoute()}
                  >
                    <Zap size={18} /> Otimizar rota
                  </button>
                  {routeDirty && (
                    <span className="dirty-label">
                      <CircleDot size={13} /> Recalcular após alterações
                    </span>
                  )}
                </div>
              </div>
              {renderScheduleAlerts()}
              {scheduleDraft.people.length ? (
                <div className="route-stats">
                  <div>
                    <span>KM total</span>
                    <strong>
                      {formatDistance(routePlan?.totalKm ?? null)}
                    </strong>
                  </div>
                  <div>
                    <span>Tempo estimado</span>
                    <strong>
                      {formatDuration(routePlan?.totalMinutes ?? null)}
                    </strong>
                  </div>
                  <div>
                    <span>Paradas</span>
                    <strong>{scheduleDraft.people.length}</strong>
                  </div>
                  <div>
                    <span>Chegada desejada</span>
                    <strong>{routePlan?.arrivalTime ?? '—'}</strong>
                  </div>
                </div>
              ) : (
                <div className="route-empty">
                  <RouteIcon size={24} />
                  <strong>Adicione pelo menos uma pessoa.</strong>
                  <span>
                    Depois, clique em otimizar para calcular ordem e horários.
                  </span>
                </div>
              )}
              {routePlan?.notice && (
                <div
                  className={`route-notice ${routePlan.totalKm == null ? 'error' : ''}`}
                >
                  <Info size={16} /> {routePlan.notice}
                </div>
              )}
              {missing > 0 && (
                <div className="route-notice error">
                  <AlertTriangle size={16} /> ⚠️{' '}
                  {missing === 1
                    ? 'Endereço não localizado.'
                    : `${missing} endereços não localizados.`}{' '}
                  Informe coordenadas para distância estimada.
                </div>
              )}
              {scheduleDraft.people.length > 0 && (
                <div className="route-stops">
                  {routePoints.map((stop, index) => (
                    <div
                      className={`route-stop ${draggingIndex === index ? 'dragging' : ''}`}
                      key={stop.id}
                      draggable
                      onDragStart={() => setDraggingIndex(index)}
                      onDragEnd={() => setDraggingIndex(null)}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={() => {
                        if (draggingIndex != null)
                          moveStop(draggingIndex, index);
                        setDraggingIndex(null);
                      }}
                      onPointerDown={(event) => {
                        if (event.pointerType === 'touch')
                          setDraggingIndex(index);
                      }}
                      onPointerEnter={(event) => {
                        if (
                          event.pointerType === 'touch' &&
                          draggingIndex != null &&
                          draggingIndex !== index
                        )
                          moveStop(draggingIndex, index);
                      }}
                      onPointerUp={() => setDraggingIndex(null)}
                    >
                      <span
                        className="drag-handle"
                        aria-label="Arraste para reordenar"
                      >
                        <GripVertical size={18} />
                      </span>
                      <span className="stop-number">
                        {String(index + 1).padStart(2, '0')}
                      </span>
                      <div className="stop-main">
                        <strong>{stop.label}</strong>
                        <small>{stop.address}</small>
                        <div className="stop-edit">
                          <input
                            aria-label={`Endereço temporário de ${stop.label}`}
                            value={stop.address}
                            onChange={(event) => {
                              const value = event.target.value;
                              setScheduleDraft((current) => ({
                                ...current,
                                people: current.people.map((person) =>
                                  person.id === stop.id
                                    ? { ...person, address: value }
                                    : person,
                                ),
                              }));
                              setRouteDirty(true);
                            }}
                          />
                          <span>somente nesta programação</span>
                        </div>
                      </div>
                      <div className="stop-meta">
                        <strong>{stop.pickupTime ?? '—'}</strong>
                        <small>
                          {formatDistance(stop.distanceKm)} ·{' '}
                          {formatDuration(stop.durationMin)}
                        </small>
                      </div>
                      <div className="stop-move">
                        <IconButton
                          label="Mover para cima"
                          onClick={() => moveStop(index, index - 1)}
                        >
                          <ArrowUp size={15} />
                        </IconButton>
                        <IconButton
                          label="Mover para baixo"
                          onClick={() => moveStop(index, index + 1)}
                        >
                          <ArrowDown size={15} />
                        </IconButton>
                      </div>
                      <IconButton
                        label={`Remover ${stop.label}`}
                        onClick={() => {
                          const person = people.find(
                            (item) => item.id === stop.id,
                          );
                          if (person) toggleSchedulePerson(person);
                        }}
                      >
                        <X size={16} />
                      </IconButton>
                    </div>
                  ))}
                  <div className="destination-stop">
                    <span className="destination-mark">D</span>
                    <div>
                      <strong>
                        {scheduleDraft.destinationName || 'Destino final'}
                      </strong>
                      <small>
                        {scheduleDraft.destinationAddress ||
                          'Selecione um destino'}
                      </small>
                    </div>
                    <div className="stop-meta">
                      <strong>
                        {routePlan?.arrivalTime ?? scheduleDraft.time}
                      </strong>
                      <small>chegada desejada</small>
                    </div>
                  </div>
                </div>
              )}
              {scheduleDraft.people.length > 1 && (
                <button
                  type="button"
                  className="button button-secondary recalculate-button"
                  onClick={() =>
                    calculateRoute(routePoints.map((stop) => stop.id))
                  }
                >
                  <RefreshCw size={16} /> Recalcular com esta ordem
                </button>
              )}
            </section>
            {dest && (
              <MiniMap
                points={routePoints}
                destination={dest}
                title="Mapa da programação"
                zoom={mapZoom}
                onZoom={setMapZoom}
              />
            )}
          </div>
          <aside className="schedule-side">
            <section className="card side-card">
              <div className="side-card-icon">
                <FileText size={18} />
              </div>
              <p className="eyebrow">CHECKLIST</p>
              <h3>Antes de salvar</h3>
              <div className="checklist">
                <span className={scheduleDraft.destinationName ? 'done' : ''}>
                  <i>
                    {scheduleDraft.destinationName ? <Check size={13} /> : '1'}
                  </i>
                  Destino definido
                </span>
                <span
                  className={
                    scheduleDraft.date && scheduleDraft.time ? 'done' : ''
                  }
                >
                  <i>
                    {scheduleDraft.date && scheduleDraft.time ? (
                      <Check size={13} />
                    ) : (
                      '2'
                    )}
                  </i>
                  Data e horário
                </span>
                <span className={scheduleDraft.people.length ? 'done' : ''}>
                  <i>
                    {scheduleDraft.people.length ? <Check size={13} /> : '3'}
                  </i>
                  Pessoas selecionadas
                </span>
                <span
                  className={
                    !routeDirty && routePlan?.totalKm != null ? 'done' : ''
                  }
                >
                  <i>
                    {!routeDirty && routePlan?.totalKm != null ? (
                      <Check size={13} />
                    ) : (
                      '4'
                    )}
                  </i>
                  Rota calculada
                </span>
              </div>
            </section>
            <section className="card side-card share-card">
              <div className="side-card-icon whatsapp-icon">
                <MessageCircle size={18} />
              </div>
              <p className="eyebrow">COMPARTILHAMENTO</p>
              <h3>Equipe alinhada</h3>
              <p>Gere um texto com a rota, horários e aviso operacional.</p>
              <button
                type="button"
                className="button whatsapp-button"
                onClick={shareWhatsApp}
              >
                <MessageCircle size={17} /> Compartilhar no WhatsApp
              </button>
              <button
                type="button"
                className="button button-secondary full-button"
                onClick={copyWhatsApp}
              >
                <Clipboard size={16} /> Copiar texto
              </button>
            </section>
            <section className="card side-card">
              <div className="side-card-icon">
                <Settings2 size={18} />
              </div>
              <p className="eyebrow">CONFIGURAÇÃO</p>
              <h3>Custo médio por km</h3>
              <p className="small-copy">
                Usado para estimar economia de trocas logísticas.
              </p>
              <div className="currency-input">
                <span>R$</span>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={costPerKm}
                  onChange={(event) => setCostPerKm(Number(event.target.value))}
                />
                <small>/ km</small>
              </div>
              <code>GOOGLE_MAPS_API_KEY</code>
            </section>
          </aside>
        </section>
      </>
    );
  }

  function renderRoutesPage() {
    const mapPoints = operationMarkers.map((marker) => toPoint(marker.person));
    const filters = (
      <div className={`map-filters ${showMapFilters ? 'open' : ''}`}>
        <div className="map-filter-head">
          <div>
            <p className="eyebrow">FILTROS DA OPERAÇÃO</p>
            <strong>Classificadores ativos</strong>
          </div>
          <IconButton
            label="Fechar filtros"
            onClick={() => setShowMapFilters(false)}
          >
            <X size={17} />
          </IconButton>
        </div>
        <div className="map-filter-grid">
          <div className="search-box">
            <Search size={16} />
            <input
              value={mapSearch}
              onChange={(event) => setMapSearch(event.target.value)}
              placeholder="Buscar classificador..."
            />
          </div>
          <select
            value={mapStatus}
            onChange={(event) => setMapStatus(event.target.value)}
          >
            <option value="all">Todos os status</option>
            {OPERATIONAL_STATUSES.map((status) => (
              <option key={status}>{status}</option>
            ))}
          </select>
          <select
            value={mapCity}
            onChange={(event) => setMapCity(event.target.value)}
          >
            <option value="all">Todas as cidades</option>
            {[
              ...new Set(
                activePeople.map((person) => person.city).filter(Boolean),
              ),
            ]
              .sort()
              .map((city) => (
                <option key={city}>{city}</option>
              ))}
          </select>
          <select
            value={mapSupervisor}
            onChange={(event) => setMapSupervisor(event.target.value)}
          >
            <option value="all">Todos os supervisores</option>
            {[
              ...new Set(
                activePeople.map((person) => person.supervisor).filter(Boolean),
              ),
            ]
              .sort()
              .map((supervisor) => (
                <option key={supervisor}>{supervisor}</option>
              ))}
          </select>
        </div>
        <div className="status-legend">
          {OPERATIONAL_STATUSES.map((status) => (
            <span
              key={status}
              className={`status-legend-item status-${cssStatus(status)}`}
            >
              {statusIcon(status)} {status}
            </span>
          ))}
        </div>
      </div>
    );
    return (
      <>
        <SectionTitle
          eyebrow="MAPA DA OPERAÇÃO"
          title="Onde estão os classificadores?"
          text="Compare localização atual, próximo destino e possíveis deslocamentos atravessados."
          action={
            <div className="title-actions">
              <button
                type="button"
                className="button button-secondary mobile-filter-button"
                onClick={() => setShowMapFilters(true)}
              >
                <SlidersHorizontal size={16} /> Filtros
              </button>
              <button
                type="button"
                className="button button-primary"
                onClick={startSchedule}
              >
                <Plus size={17} /> Programar
              </button>
            </div>
          }
        />
        <div className="routes-toolbar desktop-map-filters">{filters}</div>
        <div className="route-map-layout">
          <section className="card operation-map-card">
            <div className="card-heading">
              <div>
                <p className="eyebrow">
                  VISÃO DO DIA · {formatDate(todayIso())}
                </p>
                <h2>{operationMarkers.length} classificador(es) no mapa</h2>
              </div>
              <Badge tone="live">
                <Activity size={13} /> Atualização manual
              </Badge>
            </div>
            <MiniMap
              points={mapPoints}
              title="Mapa da operação"
              selectedId={selectedMarkerId}
              onSelect={setSelectedMarkerId}
              zoom={mapZoom}
              onZoom={setMapZoom}
            />
            {selectedMarker && (
              <div className="selected-marker-card">
                <div className="selected-marker-head">
                  <div className="person-cell">
                    <span className="avatar large-avatar">
                      {selectedMarker.person.name
                        .split(' ')
                        .slice(0, 2)
                        .map((part) => part[0])
                        .join('')}
                    </span>
                    <span>
                      <strong>{selectedMarker.person.name}</strong>
                      <small>
                        {selectedMarker.person.currentLocation ||
                          `${selectedMarker.person.city}/${selectedMarker.person.uf}`}
                      </small>
                    </span>
                  </div>
                  <IconButton
                    label="Fechar detalhe"
                    onClick={() => setSelectedMarkerId(null)}
                  >
                    <X size={17} />
                  </IconButton>
                </div>
                <div className="marker-detail-grid">
                  <div>
                    <span>Local atual</span>
                    <strong>
                      {selectedMarker.person.currentLocation ||
                        addressOf(selectedMarker.person)}
                    </strong>
                  </div>
                  <div>
                    <span>Próximo destino</span>
                    <strong>
                      {selectedMarker.destination?.label || 'Nenhum programado'}
                    </strong>
                  </div>
                  <div>
                    <span>Saída prevista</span>
                    <strong>
                      {selectedMarker.next
                        ? `${selectedMarker.next.time} · ${formatDate(selectedMarker.next.date)}`
                        : 'Disponível'}
                    </strong>
                  </div>
                  <div>
                    <span>Distância estimada</span>
                    <strong>
                      {formatDistance(selectedMarker.leg?.distanceKm ?? null)} ·{' '}
                      {formatDuration(selectedMarker.leg?.durationMin ?? null)}
                    </strong>
                  </div>
                </div>
                <div className="marker-actions">
                  <Badge tone={cssStatus(selectedMarker.status)}>
                    {statusIcon(selectedMarker.status)} {selectedMarker.status}
                  </Badge>
                  {selectedMarker.next && (
                    <button
                      type="button"
                      className="button button-secondary"
                      onClick={() =>
                        openSchedule(selectedMarker.next as Schedule)
                      }
                    >
                      <Eye size={15} /> Ver programação
                    </button>
                  )}
                  <button
                    type="button"
                    className="button button-primary"
                    onClick={() => {
                      startSchedule();
                      setTimeout(() => selectNearby(selectedMarker.person), 0);
                    }}
                  >
                    Programar esta pessoa <ArrowRight size={15} />
                  </button>
                </div>
              </div>
            )}
          </section>
          <aside className="map-sidebar">
            <section className="card map-side-card">
              <div className="card-heading">
                <div>
                  <p className="eyebrow">RANKING LOGÍSTICO</p>
                  <h3>Mais próximos do destino</h3>
                </div>
                <Crosshair size={18} />
              </div>
              {activeLocations.slice(0, 1).map((location) => {
                const sample = {
                  ...emptySchedule(),
                  locationId: location.id,
                  destinationName: location.name,
                  destinationAddress: addressOf(location),
                  destinationCity: location.city,
                  destinationLat: location.lat,
                  destinationLng: location.lng,
                };
                const ranked = activePeople
                  .map((person) => ({
                    person,
                    leg: estimateLeg(
                      toPoint(person),
                      destinationPoint(location, sample),
                    ),
                  }))
                  .filter((item) => item.leg)
                  .sort(
                    (a, b) =>
                      (a.leg?.distanceKm ?? Infinity) -
                      (b.leg?.distanceKm ?? Infinity),
                  )
                  .slice(0, 4);
                return (
                  <div className="closest-destination" key={location.id}>
                    <p>{location.name}</p>
                    {ranked.length ? (
                      ranked.map(({ person, leg }, index) => (
                        <button
                          type="button"
                          className="closest-row"
                          key={person.id}
                          onClick={() => setSelectedMarkerId(person.id)}
                        >
                          <span className="mini-rank">{index + 1}</span>
                          <span>
                            <strong>{person.name}</strong>
                            <small>
                              {person.currentLocation || person.city}
                            </small>
                          </span>
                          <b>{formatDistance(leg?.distanceKm ?? null)}</b>
                        </button>
                      ))
                    ) : (
                      <div className="inline-notice">
                        Sem coordenadas suficientes.
                      </div>
                    )}
                  </div>
                );
              })}
            </section>
            <section className="card map-side-card">
              <div className="card-heading">
                <div>
                  <p className="eyebrow">CONFIGURAÇÃO ADMINISTRATIVA</p>
                  <h3>Custo operacional</h3>
                </div>
                <Settings2 size={18} />
              </div>
              <p className="small-copy">
                O valor é usado no cálculo de economia estimada.
              </p>
              <div className="currency-input">
                <span>R$</span>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={costPerKm}
                  onChange={(event) => setCostPerKm(Number(event.target.value))}
                />
                <small>/ km</small>
              </div>
              <div className="quick-alert">
                <span className="quick-alert-number">
                  {
                    suggestions.filter((item) => item.decision === 'APLICADA')
                      .length
                  }
                </span>
                <span>
                  <strong>Trocas aplicadas</strong>
                  <small>registradas no histórico</small>
                </span>
              </div>
            </section>
            <section className="card map-side-card">
              <div className="card-heading">
                <div>
                  <p className="eyebrow">ALERTAS</p>
                  <h3>Leituras rápidas</h3>
                </div>
                <AlertTriangle size={18} />
              </div>
              <div className="quick-alert">
                <span className="quick-alert-number">
                  {
                    operationMarkers.filter(
                      (marker) => marker.leg && marker.leg.distanceKm > 180,
                    ).length
                  }
                </span>
                <span>
                  <strong>Deslocamentos longos</strong>
                  <small>acima de 180 km</small>
                </span>
              </div>
              <p className="map-note">
                <Info size={14} /> Alertas ajudam na decisão e não bloqueiam a
                programação.
              </p>
            </section>
          </aside>
        </div>
      </>
    );
  }

  function renderHistoryPage() {
    return (
      <>
        <SectionTitle
          eyebrow="CONSULTA E REPETIÇÃO"
          title="Histórico de programações"
          text="Abra, duplique ou revise qualquer embarque salvo."
          action={
            <button
              type="button"
              className="button button-primary"
              onClick={startSchedule}
            >
              <Plus size={17} /> Nova programação
            </button>
          }
        />
        <section className="card table-card">
          <div className="toolbar history-toolbar">
            <div className="date-filters">
              <Field label="Data inicial">
                <input
                  type="date"
                  value={historyStart}
                  onChange={(event) => setHistoryStart(event.target.value)}
                />
              </Field>
              <Field label="Data final">
                <input
                  type="date"
                  value={historyEnd}
                  onChange={(event) => setHistoryEnd(event.target.value)}
                />
              </Field>
            </div>
            <div className="search-box">
              <Search size={17} />
              <input
                value={scheduleSearch}
                onChange={(event) => setScheduleSearch(event.target.value)}
                placeholder="Buscar pessoa, destino..."
              />
            </div>
            <select
              value={scheduleStatus}
              onChange={(event) => setScheduleStatus(event.target.value)}
            >
              <option value="all">Todos os status</option>
              {(
                [
                  'Rascunho',
                  'Programado',
                  'Finalizado',
                  'Cancelado',
                ] as ScheduleStatus[]
              ).map((status) => (
                <option key={status}>{status}</option>
              ))}
            </select>
            <span className="result-count">
              {historySchedules.length} programação(ões)
            </span>
          </div>
          {historySchedules.length ? (
            <div className="responsive-table">
              <table>
                <thead>
                  <tr>
                    <th>Data / horário</th>
                    <th>Destino</th>
                    <th>Pessoas</th>
                    <th>KM</th>
                    <th>Tempo</th>
                    <th>Status</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {historySchedules.map((schedule) => (
                    <tr key={schedule.id}>
                      <td>
                        <strong>{formatDate(schedule.date)}</strong>
                        <small className="table-subtext">{schedule.time}</small>
                      </td>
                      <td>
                        <strong>{schedule.destinationName}</strong>
                        <small className="table-subtext">
                          {schedule.destinationCity}/{schedule.destinationUf}
                        </small>
                      </td>
                      <td>{schedule.people.length}</td>
                      <td>{formatDistance(schedule.totalKm)}</td>
                      <td>{formatDuration(schedule.totalMinutes)}</td>
                      <td>
                        <Badge tone={cssStatus(schedule.status)}>
                          {schedule.status}
                        </Badge>
                      </td>
                      <td>
                        <div className="row-actions">
                          <IconButton
                            label="Abrir programação"
                            onClick={() => openSchedule(schedule)}
                          >
                            <Eye size={16} />
                          </IconButton>
                          <IconButton
                            label="Duplicar programação"
                            onClick={() => openSchedule(schedule, true)}
                          >
                            <Copy size={16} />
                          </IconButton>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              icon={History}
              title="Nenhuma programação neste filtro"
              text="Ajuste as datas ou salve um novo embarque."
              action={
                <button
                  type="button"
                  className="button button-secondary"
                  onClick={startSchedule}
                >
                  <Plus size={16} /> Criar programação
                </button>
              }
            />
          )}
        </section>
        <section className="card suggestion-history">
          <div className="card-heading">
            <div>
              <p className="eyebrow">AUDITORIA DE DECISÕES</p>
              <h2>Histórico de sugestões</h2>
            </div>
            <Sparkles size={18} />
          </div>
          {suggestions.length ? (
            <div className="suggestion-history-list">
              {suggestions
                .slice()
                .reverse()
                .map((item) => (
                  <div className="suggestion-history-row" key={item.id}>
                    <span>
                      <strong>
                        {item.originalPerson} → {item.suggestedPerson}
                      </strong>
                      <small>
                        {formatDate(item.date.slice(0, 10))} · economia
                        potencial {formatDistance(item.economyKm)}
                      </small>
                    </span>
                    <Badge
                      tone={
                        item.decision === 'APLICADA' ? 'active' : 'inactive'
                      }
                    >
                      {item.decision}
                    </Badge>
                  </div>
                ))}
            </div>
          ) : (
            <p className="section-description">
              As decisões de troca aplicadas ou ignoradas aparecerão aqui.
            </p>
          )}
        </section>
      </>
    );
  }
  function renderComparisonModal() {
    if (!comparison) return null;
    const economy = Math.max(0, comparison.originalKm - comparison.suggestedKm);
    const time = Math.max(0, comparison.originalMin - comparison.suggestedMin);
    return (
      <div
        className="modal-backdrop"
        role="dialog"
        aria-modal="true"
        aria-label="Comparar programação"
      >
        <div className="comparison-modal">
          <div className="card-heading">
            <div>
              <p className="eyebrow">INTELIGÊNCIA LOGÍSTICA</p>
              <h2>Comparar programação</h2>
            </div>
            <IconButton
              label="Fechar comparação"
              onClick={() => setComparison(null)}
            >
              <X size={18} />
            </IconButton>
          </div>
          <div className="comparison-grid">
            <article>
              <p>CENÁRIO ATUAL</p>
              <h3>{comparison.original.name}</h3>
              <span>→ {scheduleDraft.destinationName}</span>
              <strong>{formatDistance(comparison.originalKm)}</strong>
              <small>{formatDuration(comparison.originalMin)}</small>
            </article>
            <div className="comparison-arrow">
              <ArrowRight size={22} />
            </div>
            <article className="best-scenario">
              <p>SUGESTÃO</p>
              <h3>{comparison.suggested.name}</h3>
              <span>→ {scheduleDraft.destinationName}</span>
              <strong>{formatDistance(comparison.suggestedKm)}</strong>
              <small>{formatDuration(comparison.suggestedMin)}</small>
            </article>
          </div>
          <div className="comparison-economy">
            <span>
              <strong>{formatDistance(economy)}</strong>
              <small>economia de km</small>
            </span>
            <span>
              <strong>{formatDuration(time)}</strong>
              <small>tempo economizado</small>
            </span>
            <span>
              <strong>
                R${' '}
                {(economy * costPerKm).toLocaleString('pt-BR', {
                  minimumFractionDigits: 2,
                })}
              </strong>
              <small>economia estimada</small>
            </span>
          </div>
          <div className="modal-actions">
            <button
              type="button"
              className="button button-secondary"
              onClick={() => setComparison(null)}
            >
              Manter original
            </button>
            <button
              type="button"
              className="button button-primary"
              onClick={() => {
                const suggestion = suggestionForSchedule();
                if (suggestion) applySuggestion(suggestion);
                setComparison(null);
              }}
            >
              Aplicar troca
            </button>
          </div>
        </div>
      </div>
    );
  }
  function content() {
    if (!ready)
      return (
        <div className="loading-page">
          <img src="/its-agro-logo.png" alt="IT'S AGRO" />
          <span>Carregando operação...</span>
        </div>
      );
    if (view === 'people') return renderPeoplePage();
    if (view === 'locations') return renderLocationsPage();
    if (view === 'schedule') return renderSchedulePage();
    if (view === 'routes') return renderRoutesPage();
    if (view === 'history') return renderHistoryPage();
    return renderDashboard();
  }
  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileMenu ? 'mobile-open' : ''}`}>
        <div className="brand">
          <img src="/its-agro-logo.png" alt="IT'S AGRO" />
          <div>
            <strong>PROGRAMAÇÃO</strong>
            <span>Centro operacional</span>
          </div>
          <button
            type="button"
            className="sidebar-close"
            onClick={() => setMobileMenu(false)}
            aria-label="Fechar menu"
          >
            <X size={19} />
          </button>
        </div>
        <nav className="main-nav" aria-label="Navegação principal">
          {NAV.map(({ id, label, icon: Icon }) => (
            <button
              type="button"
              className={`nav-item ${view === id ? 'active' : ''}`}
              key={id}
              onClick={() => navigate(id)}
            >
              <Icon size={18} />
              <span>{label}</span>
              {id === 'routes' &&
                operationMarkers.some(
                  (marker) => marker.status === 'Programado',
                ) && <i className="nav-dot" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="connection-status">
            <span className="online-dot" />
            <span>
              <strong>Modo local</strong>
              <small>Dados salvos neste dispositivo</small>
            </span>
          </div>
          <p>
            IT'S AGRO
            <br />
            <span>Operação que aproxima pessoas</span>
          </p>
        </div>
      </aside>
      <div className="app-main">
        <header className="topbar">
          <button
            type="button"
            className="mobile-menu-button"
            onClick={() => setMobileMenu(true)}
            aria-label="Abrir menu"
          >
            <Menu size={21} />
          </button>
          <div className="mobile-brand">
            <img src="/its-agro-logo.png" alt="IT'S AGRO" />
          </div>
          <div className="breadcrumbs">
            <span>Operação</span>
            <ChevronRight size={14} />
            <strong>{NAV.find((item) => item.id === view)?.label}</strong>
          </div>
          <div className="topbar-actions">
            <span className="environment-pill">
              <span className="online-dot" /> Ambiente de testes
            </span>
            <button
              type="button"
              className="user-menu"
              aria-label="Usuário Operação"
            >
              <span>OP</span>
              <strong>Operação</strong>
              <ChevronDown size={14} />
            </button>
          </div>
        </header>
        <main className="content">{content()}</main>
      </div>
      {toast && (
        <div className={`toast toast-${toast.tone}`} role="status">
          <span>
            {toast.tone === 'success' ? (
              <Check size={17} />
            ) : toast.tone === 'error' ? (
              <AlertTriangle size={17} />
            ) : (
              <Info size={17} />
            )}
          </span>
          {toast.message}
          <button
            type="button"
            onClick={() => setToast(null)}
            aria-label="Fechar aviso"
          >
            <X size={15} />
          </button>
        </div>
      )}
      <div className="mobile-bottom-nav">
        {NAV.slice(0, 5).map(({ id, label, icon: Icon }) => (
          <button
            type="button"
            className={view === id ? 'active' : ''}
            key={id}
            onClick={() => navigate(id)}
          >
            <Icon size={18} />
            <span>
              {label === 'Locais de embarque'
                ? 'Locais'
                : label === 'Mapa da operação'
                  ? 'Mapa'
                  : label}
            </span>
          </button>
        ))}
      </div>
      {renderComparisonModal()}
    </div>
  );
}
