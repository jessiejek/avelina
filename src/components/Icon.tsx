import React from "react";
import {
  // Core / nav
  Package, PackagePlus, PackageCheck, PackageX, Boxes, Box, Archive,
  BookOpen, Book, BookMarked, ScrollText, FileText, File, Files, Folder, FolderOpen,
  Menu, MoreHorizontal, MoreVertical, LayoutGrid, LayoutDashboard, List, ListChecks, Table,
  // Charts / data
  BarChart3, BarChart2, PieChart, LineChart, TrendingUp, TrendingDown, Activity, Gauge,
  // Actions
  PlusCircle, Plus, MinusCircle, Minus, X, XCircle, Check, CheckCircle2, CheckCheck,
  Settings, Settings2, SlidersHorizontal, Filter, ListFilter, ArrowUpDown,
  Search, ZoomIn, ZoomOut, Download, Upload, Share2, Link, Link2, ExternalLink,
  Copy, Clipboard, ClipboardList, ClipboardCheck, Printer, Save,
  RefreshCcw, RefreshCw, RotateCw, RotateCcw, Repeat, Shuffle, Power, LogIn, LogOut,
  Edit, Pencil, PencilLine, Trash, Trash2, Eraser, Scissors, Wrench, Hammer,
  // Comms
  Bell, BellRing, BellOff, Mail, MailOpen, Send, MessageSquare, MessageCircle,
  Phone, PhoneCall, Smartphone,
  // People
  User, Users, UserPlus, UserCircle2, UserCheck,
  // Place
  MapPin, Map, Navigation, Globe, Home, Building, Building2, Store, Warehouse,
  // Commerce / money
  ShoppingCart, ShoppingBag, Gift, Tag, Tags, Receipt, ReceiptText, CreditCard,
  Wallet, Coins, Banknote, DollarSign, Percent, Calculator, HandCoins, PiggyBank,
  Landmark, BadgeCheck, BadgePercent, CircleDollarSign, QrCode, Barcode, ScanLine,
  // Time
  Calendar, CalendarDays, CalendarCheck, Clock, Timer, TimerReset, Hourglass, AlarmClock, History,
  // Food / bakery
  Wheat, Egg, EggFried, Milk, Coffee, CupSoda, Cookie, Cake, CakeSlice, Croissant, Pizza,
  IceCream, IceCreamCone, Apple, Banana, Cherry, Grape, Carrot, Nut, Candy, Donut, Soup,
  CookingPot, Utensils, UtensilsCrossed, ChefHat, Salad, Beef, Fish, Sandwich, Wine, Beer, Citrus,
  // Science / measure / nature
  FlaskConical, TestTube, Beaker, Microscope, Pill, Scale, Ruler, Thermometer,
  Droplet, Droplets, Flame, Snowflake, Wind, Sun, Moon, Cloud, CloudRain, Zap,
  Leaf, Sprout, TreePine, Flower, Recycle,
  // Transport
  Truck, Bike, Car, Plane, Ship,
  // Security
  Lock, Unlock, Key, KeyRound, Shield, ShieldCheck, Eye, EyeOff, Fingerprint,
  // Status / feedback
  Star, Heart, Bookmark, ThumbsUp, ThumbsDown, Award, Trophy, Medal, Crown, Sparkles, Flag,
  AlertTriangle, AlertCircle, AlertOctagon, Info, HelpCircle, Ban,
  // Media
  Camera, Image, ImagePlus, Video, Mic, Play, Pause, Square,
  // Arrows / chevrons
  ChevronRight, ChevronLeft, ChevronUp, ChevronDown, ChevronsUpDown,
  ArrowRight, ArrowLeft, ArrowUp, ArrowDown, ArrowUpRight, ArrowDownRight, Move,
  // Misc
  Hash, AtSign, Lightbulb, Megaphone, Pin, Paperclip, Inbox, Bug, Code, Terminal,
  Database, Server, Wifi, Battery,
  Facebook, Instagram, Twitter, Youtube, Linkedin,
  Smile, Frown, Meh,
} from "lucide-react";

type Comp = React.ComponentType<{ size?: number; className?: string; strokeWidth?: number }>;

const map: Record<string, Comp> = {
  // ── existing keys (kept) ──
  inventory_2: Package,
  menu_book: BookOpen,
  history_edu: ScrollText,
  query_stats: BarChart3,
  add_circle: PlusCircle,
  settings: Settings,
  add: Plus,
  search: Search,
  notifications: Bell,
  grain: Wheat,
  water_drop: Droplets,
  science: FlaskConical,
  auto_awesome: Sparkles,
  egg: Egg,
  scale: Scale,
  arrow_back: ArrowLeft,
  close: X,
  chevron_right: ChevronRight,
  chevron_left: ChevronLeft,
  filter_list: ListFilter,
  download: Download,
  photo_camera: Camera,
  warning: AlertTriangle,
  check_circle: CheckCircle2,
  error: AlertCircle,
  info: Info,
  history: History,
  trending_up: TrendingUp,
  trending_flat: ArrowRight,
  trending_down: TrendingDown,
  local_shipping: Truck,
  restaurant: Utensils,
  timer: Clock,
  print: Printer,
  build: Wrench,
  unfold_more: ChevronsUpDown,
  keyboard_arrow_down: ChevronDown,
  remove: Minus,
  sync_alt: RefreshCcw,
  oven_gen: Flame,
  breakfast_dining: Coffee,
  compost: Leaf,
  thermostat: Thermometer,
  menu: Menu,
  local_cafe: Coffee,
  cookie: Cookie,
  nutrition: Apple,
  set_meal: Utensils,
  cake: UtensilsCrossed,
  recycle: Recycle,
  bar_chart: BarChart2,
  tune: SlidersHorizontal,
  account_circle: UserCircle2,
  check: Check,
  swap_vert: ArrowUpDown,
  shopping_cart: ShoppingCart,
  water: Droplet,
  business: Building2,
  star: Star,
  calendar_today: CalendarDays,
  assignment: ClipboardList,
  show_chart: Activity,
  tag: Hash,
  shopping_bag: ShoppingBag,
  lock: Lock,
  facebook: Facebook,
  mail: Mail,
  g_translate: Globe,
  menu_book_outlined: BookMarked,
  delete: Trash2,
  edit: Pencil,
  image: Image,
  add_photo_alternate: ImagePlus,
  logout: LogOut,
  bakery_dining: Croissant,
  wallet: Wallet,
  payments: Coins,
  receipt_long: ReceiptText,

  // ── expanded set ──
  // packaging / inventory
  package: Package, package_add: PackagePlus, package_check: PackageCheck, package_x: PackageX,
  boxes: Boxes, box: Box, archive: Archive, warehouse: Warehouse, inbox: Inbox,
  // docs / files
  book: Book, file: File, files: Files, file_text: FileText, folder: Folder, folder_open: FolderOpen,
  scroll: ScrollText, clipboard: Clipboard, clipboard_check: ClipboardCheck, copy: Copy, save: Save,
  // layout / nav
  more_horiz: MoreHorizontal, more_vert: MoreVertical, grid: LayoutGrid, dashboard: LayoutDashboard,
  list: List, list_checks: ListChecks, table: Table,
  // charts
  pie_chart: PieChart, line_chart: LineChart, gauge: Gauge,
  // actions
  add_circle_outline: PlusCircle, remove_circle: MinusCircle, cancel: XCircle, done_all: CheckCheck,
  settings_alt: Settings2, filter: Filter, zoom_in: ZoomIn, zoom_out: ZoomOut,
  upload: Upload, share: Share2, link: Link, link2: Link2, external_link: ExternalLink,
  refresh: RefreshCw, rotate_cw: RotateCw, rotate_ccw: RotateCcw, repeat: Repeat, shuffle: Shuffle,
  power: Power, login: LogIn, edit_alt: Edit, edit_line: PencilLine, eraser: Eraser,
  scissors: Scissors, hammer: Hammer, trash: Trash, wrench: Wrench,
  // comms
  bell_ring: BellRing, bell_off: BellOff, mail_open: MailOpen, send: Send,
  message: MessageSquare, chat: MessageCircle, phone: Phone, call: PhoneCall, smartphone: Smartphone,
  // people
  person: User, people: Users, person_add: UserPlus, person_check: UserCheck,
  // place
  location: MapPin, map: Map, navigation: Navigation, globe: Globe, home: Home,
  building: Building, store: Store,
  // money / commerce
  gift: Gift, tags: Tags, receipt: Receipt, credit_card: CreditCard, coins: Coins,
  banknote: Banknote, dollar: DollarSign, percent: Percent, calculator: Calculator,
  hand_coins: HandCoins, piggy_bank: PiggyBank, bank: Landmark, badge_check: BadgeCheck,
  badge_percent: BadgePercent, money: CircleDollarSign, qr_code: QrCode, barcode: Barcode, scan: ScanLine,
  // time
  calendar: Calendar, calendar_check: CalendarCheck, clock: Clock, timer_reset: TimerReset,
  hourglass: Hourglass, alarm: AlarmClock,
  // food
  egg_fried: EggFried, milk: Milk, coffee: Coffee, soda: CupSoda, cake_slice: CakeSlice,
  croissant: Croissant, pizza: Pizza, ice_cream: IceCream, ice_cream_cone: IceCreamCone,
  apple: Apple, banana: Banana, cherry: Cherry, grape: Grape, carrot: Carrot, nut: Nut,
  candy: Candy, donut: Donut, soup: Soup, pot: CookingPot, utensils: Utensils,
  utensils_crossed: UtensilsCrossed, chef: ChefHat, salad: Salad, beef: Beef, fish: Fish,
  sandwich: Sandwich, wine: Wine, beer: Beer, citrus: Citrus, wheat: Wheat,
  // science / measure / nature
  test_tube: TestTube, beaker: Beaker, microscope: Microscope, pill: Pill, ruler: Ruler,
  droplet: Droplet, droplets: Droplets, flame: Flame, snowflake: Snowflake, wind: Wind,
  sun: Sun, moon: Moon, cloud: Cloud, rain: CloudRain, bolt: Zap, leaf: Leaf,
  sprout: Sprout, tree: TreePine, flower: Flower,
  // transport
  truck: Truck, bike: Bike, car: Car, plane: Plane, ship: Ship,
  // security
  unlock: Unlock, key: Key, key_round: KeyRound, shield: Shield, shield_check: ShieldCheck,
  eye: Eye, eye_off: EyeOff, fingerprint: Fingerprint,
  // status / feedback
  heart: Heart, bookmark: Bookmark, thumb_up: ThumbsUp, thumb_down: ThumbsDown,
  award: Award, trophy: Trophy, medal: Medal, crown: Crown, sparkles: Sparkles, flag: Flag,
  alert: AlertOctagon, help: HelpCircle, block: Ban,
  // media
  video: Video, mic: Mic, play: Play, pause: Pause, stop: Square,
  // arrows
  chevron_up: ChevronUp, chevron_down: ChevronDown, arrow_right: ArrowRight,
  arrow_up: ArrowUp, arrow_down: ArrowDown, arrow_up_right: ArrowUpRight,
  arrow_down_right: ArrowDownRight, move: Move,
  // misc
  hash: Hash, at: AtSign, lightbulb: Lightbulb, megaphone: Megaphone, pin: Pin,
  paperclip: Paperclip, bug: Bug, code: Code, terminal: Terminal, database: Database,
  server: Server, wifi: Wifi, battery: Battery,
  instagram: Instagram, twitter: Twitter, youtube: Youtube, linkedin: Linkedin,
  smile: Smile, frown: Frown, meh: Meh,
};

interface Props {
  name: string;
  size?: number;
  className?: string;
  strokeWidth?: number;
}

export default function Icon({ name, size = 20, className = "", strokeWidth = 1.75 }: Props) {
  const Component = map[name] ?? Package;
  return <Component size={size} className={className} strokeWidth={strokeWidth} />;
}
