/**
 * The app's icon set (#345). Every icon in the spa comes from here, so a later
 * swap of icon library touches this one file. ESLint blocks importing an icon
 * package anywhere else (see eslint.config.mjs).
 *
 * Icons are Phosphor (https://phosphoricons.com), regular weight. The active
 * bottom-nav tab passes `weight="fill"`. Colour is `currentColor`.
 *
 * Each icon is imported from Phosphor's SSR entry, which reads no React
 * context, so the same exports work in server and client components.
 *
 * The thin wrapper keeps two things stable across libraries:
 * - a 24px default size (what Lucide rendered before), so an icon without a
 *   size class looks the same as it did; a `className` like `size-4` or
 *   `h-5 w-5` still wins, because CSS overrides the svg's width/height;
 * - a `data-icon` attribute naming the glyph, for tests and debugging.
 */
import type { ReactElement } from "react"
import type { Icon as PhosphorIcon, IconProps } from "@phosphor-icons/react"
import type { IdeaIconKey } from "@/lib/idea-icons"
import { ArrowCounterClockwiseIcon as PhArrowCounterClockwise } from "@phosphor-icons/react/dist/ssr/ArrowCounterClockwise"
import { ArrowLeftIcon as PhArrowLeft } from "@phosphor-icons/react/dist/ssr/ArrowLeft"
import { ArrowRightIcon as PhArrowRight } from "@phosphor-icons/react/dist/ssr/ArrowRight"
import { ArrowSquareOutIcon as PhArrowSquareOut } from "@phosphor-icons/react/dist/ssr/ArrowSquareOut"
import { ArrowsLeftRightIcon as PhArrowsLeftRight } from "@phosphor-icons/react/dist/ssr/ArrowsLeftRight"
import { ArrowsOutIcon as PhArrowsOut } from "@phosphor-icons/react/dist/ssr/ArrowsOut"
import { AtIcon as PhAt } from "@phosphor-icons/react/dist/ssr/At"
import { BankIcon as PhBank } from "@phosphor-icons/react/dist/ssr/Bank"
import { BarbellIcon as PhBarbell } from "@phosphor-icons/react/dist/ssr/Barbell"
import { BasketIcon as PhBasket } from "@phosphor-icons/react/dist/ssr/Basket"
import { BeerSteinIcon as PhBeerStein } from "@phosphor-icons/react/dist/ssr/BeerStein"
import { BellIcon as PhBell } from "@phosphor-icons/react/dist/ssr/Bell"
import { BinocularsIcon as PhBinoculars } from "@phosphor-icons/react/dist/ssr/Binoculars"
import { BirdIcon as PhBird } from "@phosphor-icons/react/dist/ssr/Bird"
import { BooksIcon as PhBooks } from "@phosphor-icons/react/dist/ssr/Books"
import { BowlFoodIcon as PhBowlFood } from "@phosphor-icons/react/dist/ssr/BowlFood"
import { BreadIcon as PhBread } from "@phosphor-icons/react/dist/ssr/Bread"
import { BugIcon as PhBug } from "@phosphor-icons/react/dist/ssr/Bug"
import { CakeIcon as PhCake } from "@phosphor-icons/react/dist/ssr/Cake"
import { CalendarBlankIcon as PhCalendarBlank } from "@phosphor-icons/react/dist/ssr/CalendarBlank"
import { CameraIcon as PhCamera } from "@phosphor-icons/react/dist/ssr/Camera"
import { CaretDownIcon as PhCaretDown } from "@phosphor-icons/react/dist/ssr/CaretDown"
import { CaretLeftIcon as PhCaretLeft } from "@phosphor-icons/react/dist/ssr/CaretLeft"
import { CaretRightIcon as PhCaretRight } from "@phosphor-icons/react/dist/ssr/CaretRight"
import { CarrotIcon as PhCarrot } from "@phosphor-icons/react/dist/ssr/Carrot"
import { ChatIcon as PhChat } from "@phosphor-icons/react/dist/ssr/Chat"
import { ChatTextIcon as PhChatText } from "@phosphor-icons/react/dist/ssr/ChatText"
import { CheckIcon as PhCheck } from "@phosphor-icons/react/dist/ssr/Check"
import { CheckCircleIcon as PhCheckCircle } from "@phosphor-icons/react/dist/ssr/CheckCircle"
import { CircleNotchIcon as PhCircleNotch } from "@phosphor-icons/react/dist/ssr/CircleNotch"
import { ClockIcon as PhClock } from "@phosphor-icons/react/dist/ssr/Clock"
import { CoffeeIcon as PhCoffee } from "@phosphor-icons/react/dist/ssr/Coffee"
import { ConfettiIcon as PhConfetti } from "@phosphor-icons/react/dist/ssr/Confetti"
import { CopyIcon as PhCopy } from "@phosphor-icons/react/dist/ssr/Copy"
import { CouchIcon as PhCouch } from "@phosphor-icons/react/dist/ssr/Couch"
import { DiceFiveIcon as PhDiceFive } from "@phosphor-icons/react/dist/ssr/DiceFive"
import { DiscoBallIcon as PhDiscoBall } from "@phosphor-icons/react/dist/ssr/DiscoBall"
import { DotsThreeIcon as PhDotsThree } from "@phosphor-icons/react/dist/ssr/DotsThree"
import { EnvelopeIcon as PhEnvelope } from "@phosphor-icons/react/dist/ssr/Envelope"
import { EyeSlashIcon as PhEyeSlash } from "@phosphor-icons/react/dist/ssr/EyeSlash"
import { FileTextIcon as PhFileText } from "@phosphor-icons/react/dist/ssr/FileText"
import { FilmSlateIcon as PhFilmSlate } from "@phosphor-icons/react/dist/ssr/FilmSlate"
import { FireIcon as PhFire } from "@phosphor-icons/react/dist/ssr/Fire"
import { FlagIcon as PhFlag } from "@phosphor-icons/react/dist/ssr/Flag"
import { FlameIcon as PhFlame } from "@phosphor-icons/react/dist/ssr/Flame"
import { FlowerIcon as PhFlower } from "@phosphor-icons/react/dist/ssr/Flower"
import { ForkKnifeIcon as PhForkKnife } from "@phosphor-icons/react/dist/ssr/ForkKnife"
import { FunnelSimpleIcon as PhFunnelSimple } from "@phosphor-icons/react/dist/ssr/FunnelSimple"
import { GearIcon as PhGear } from "@phosphor-icons/react/dist/ssr/Gear"
import { GlobeIcon as PhGlobe } from "@phosphor-icons/react/dist/ssr/Globe"
import { GpsFixIcon as PhGpsFix } from "@phosphor-icons/react/dist/ssr/GpsFix"
import { HamburgerIcon as PhHamburger } from "@phosphor-icons/react/dist/ssr/Hamburger"
import { HandGrabbingIcon as PhHandGrabbing } from "@phosphor-icons/react/dist/ssr/HandGrabbing"
import { HouseIcon as PhHouse } from "@phosphor-icons/react/dist/ssr/House"
import { IceCreamIcon as PhIceCream } from "@phosphor-icons/react/dist/ssr/IceCream"
import { InfoIcon as PhInfo } from "@phosphor-icons/react/dist/ssr/Info"
import { LeafIcon as PhLeaf } from "@phosphor-icons/react/dist/ssr/Leaf"
import { LifebuoyIcon as PhLifebuoy } from "@phosphor-icons/react/dist/ssr/Lifebuoy"
import { LinkIcon as PhLink } from "@phosphor-icons/react/dist/ssr/Link"
import { ListIcon as PhList } from "@phosphor-icons/react/dist/ssr/List"
import { ListBulletsIcon as PhListBullets } from "@phosphor-icons/react/dist/ssr/ListBullets"
import { LockIcon as PhLock } from "@phosphor-icons/react/dist/ssr/Lock"
import { LockKeyIcon as PhLockKey } from "@phosphor-icons/react/dist/ssr/LockKey"
import { MagnifyingGlassIcon as PhMagnifyingGlass } from "@phosphor-icons/react/dist/ssr/MagnifyingGlass"
import { MapPinIcon as PhMapPin } from "@phosphor-icons/react/dist/ssr/MapPin"
import { MapTrifoldIcon as PhMapTrifold } from "@phosphor-icons/react/dist/ssr/MapTrifold"
import { MartiniIcon as PhMartini } from "@phosphor-icons/react/dist/ssr/Martini"
import { MaskHappyIcon as PhMaskHappy } from "@phosphor-icons/react/dist/ssr/MaskHappy"
import { MegaphoneIcon as PhMegaphone } from "@phosphor-icons/react/dist/ssr/Megaphone"
import { MicrophoneStageIcon as PhMicrophoneStage } from "@phosphor-icons/react/dist/ssr/MicrophoneStage"
import { MinusIcon as PhMinus } from "@phosphor-icons/react/dist/ssr/Minus"
import { MoonIcon as PhMoon } from "@phosphor-icons/react/dist/ssr/Moon"
import { MountainsIcon as PhMountains } from "@phosphor-icons/react/dist/ssr/Mountains"
import { MusicNotesIcon as PhMusicNotes } from "@phosphor-icons/react/dist/ssr/MusicNotes"
import { NavigationArrowIcon as PhNavigationArrow } from "@phosphor-icons/react/dist/ssr/NavigationArrow"
import { PaintBrushIcon as PhPaintBrush } from "@phosphor-icons/react/dist/ssr/PaintBrush"
import { PaletteIcon as PhPalette } from "@phosphor-icons/react/dist/ssr/Palette"
import { PaperPlaneRightIcon as PhPaperPlaneRight } from "@phosphor-icons/react/dist/ssr/PaperPlaneRight"
import { PencilSimpleIcon as PhPencilSimple } from "@phosphor-icons/react/dist/ssr/PencilSimple"
import { PersonSimpleBikeIcon as PhPersonSimpleBike } from "@phosphor-icons/react/dist/ssr/PersonSimpleBike"
import { PersonSimpleRunIcon as PhPersonSimpleRun } from "@phosphor-icons/react/dist/ssr/PersonSimpleRun"
import { PersonSimpleSwimIcon as PhPersonSimpleSwim } from "@phosphor-icons/react/dist/ssr/PersonSimpleSwim"
import { PersonSimpleTaiChiIcon as PhPersonSimpleTaiChi } from "@phosphor-icons/react/dist/ssr/PersonSimpleTaiChi"
import { PersonSimpleWalkIcon as PhPersonSimpleWalk } from "@phosphor-icons/react/dist/ssr/PersonSimpleWalk"
import { PingPongIcon as PhPingPong } from "@phosphor-icons/react/dist/ssr/PingPong"
import { PlanetIcon as PhPlanet } from "@phosphor-icons/react/dist/ssr/Planet"
import { PlantIcon as PhPlant } from "@phosphor-icons/react/dist/ssr/Plant"
import { PlusIcon as PhPlus } from "@phosphor-icons/react/dist/ssr/Plus"
import { QuestionIcon as PhQuestion } from "@phosphor-icons/react/dist/ssr/Question"
import { QrCodeIcon as PhQrCode } from "@phosphor-icons/react/dist/ssr/QrCode"
import { RepeatIcon as PhRepeat } from "@phosphor-icons/react/dist/ssr/Repeat"
import { ScalesIcon as PhScales } from "@phosphor-icons/react/dist/ssr/Scales"
import { ShareNetworkIcon as PhShareNetwork } from "@phosphor-icons/react/dist/ssr/ShareNetwork"
import { ShieldIcon as PhShield } from "@phosphor-icons/react/dist/ssr/Shield"
import { ShieldCheckIcon as PhShieldCheck } from "@phosphor-icons/react/dist/ssr/ShieldCheck"
import { ShieldWarningIcon as PhShieldWarning } from "@phosphor-icons/react/dist/ssr/ShieldWarning"
import { SignOutIcon as PhSignOut } from "@phosphor-icons/react/dist/ssr/SignOut"
import { SneakerIcon as PhSneaker } from "@phosphor-icons/react/dist/ssr/Sneaker"
import { SnowflakeIcon as PhSnowflake } from "@phosphor-icons/react/dist/ssr/Snowflake"
import { SoccerBallIcon as PhSoccerBall } from "@phosphor-icons/react/dist/ssr/SoccerBall"
import { SparkleIcon as PhSparkle } from "@phosphor-icons/react/dist/ssr/Sparkle"
import { StorefrontIcon as PhStorefront } from "@phosphor-icons/react/dist/ssr/Storefront"
import { SunIcon as PhSun } from "@phosphor-icons/react/dist/ssr/Sun"
import { SunHorizonIcon as PhSunHorizon } from "@phosphor-icons/react/dist/ssr/SunHorizon"
import { TagIcon as PhTag } from "@phosphor-icons/react/dist/ssr/Tag"
import { TrashIcon as PhTrash } from "@phosphor-icons/react/dist/ssr/Trash"
import { TreeIcon as PhTree } from "@phosphor-icons/react/dist/ssr/Tree"
import { TreeEvergreenIcon as PhTreeEvergreen } from "@phosphor-icons/react/dist/ssr/TreeEvergreen"
import { UploadSimpleIcon as PhUploadSimple } from "@phosphor-icons/react/dist/ssr/UploadSimple"
import { UserIcon as PhUser } from "@phosphor-icons/react/dist/ssr/User"
import { UserCheckIcon as PhUserCheck } from "@phosphor-icons/react/dist/ssr/UserCheck"
import { UserCircleIcon as PhUserCircle } from "@phosphor-icons/react/dist/ssr/UserCircle"
import { UserMinusIcon as PhUserMinus } from "@phosphor-icons/react/dist/ssr/UserMinus"
import { UserPlusIcon as PhUserPlus } from "@phosphor-icons/react/dist/ssr/UserPlus"
import { UsersIcon as PhUsers } from "@phosphor-icons/react/dist/ssr/Users"
import { VinylRecordIcon as PhVinylRecord } from "@phosphor-icons/react/dist/ssr/VinylRecord"
import { WarningIcon as PhWarning } from "@phosphor-icons/react/dist/ssr/Warning"
import { WarningCircleIcon as PhWarningCircle } from "@phosphor-icons/react/dist/ssr/WarningCircle"
import { WavesIcon as PhWaves } from "@phosphor-icons/react/dist/ssr/Waves"
import { WindIcon as PhWind } from "@phosphor-icons/react/dist/ssr/Wind"
import { WineIcon as PhWine } from "@phosphor-icons/react/dist/ssr/Wine"
import { XIcon as PhX } from "@phosphor-icons/react/dist/ssr/X"
import { XCircleIcon as PhXCircle } from "@phosphor-icons/react/dist/ssr/XCircle"

export type { IconProps, IconWeight } from "@phosphor-icons/react"

/** An icon component from this module. */
export type Icon = (props: IconProps) => ReactElement

function appIcon(Glyph: PhosphorIcon, name: string): Icon {
  function AppIcon(props: IconProps) {
    return <Glyph size={24} data-icon={name} {...props} />
  }
  AppIcon.displayName = `Icon(${name})`
  return AppIcon
}

export const ArrowCounterClockwiseIcon = appIcon(
  PhArrowCounterClockwise,
  "arrow-counter-clockwise"
)
export const ArrowLeftIcon = appIcon(PhArrowLeft, "arrow-left")
export const ArrowRightIcon = appIcon(PhArrowRight, "arrow-right")
export const ArrowSquareOutIcon = appIcon(PhArrowSquareOut, "arrow-square-out")
export const ArrowsOutIcon = appIcon(PhArrowsOut, "arrows-out")
export const AtIcon = appIcon(PhAt, "at")
export const BankIcon = appIcon(PhBank, "bank")
export const BarbellIcon = appIcon(PhBarbell, "barbell")
export const BellIcon = appIcon(PhBell, "bell")
export const BugIcon = appIcon(PhBug, "bug")
export const CalendarBlankIcon = appIcon(PhCalendarBlank, "calendar-blank")
export const CameraIcon = appIcon(PhCamera, "camera")
export const CaretDownIcon = appIcon(PhCaretDown, "caret-down")
export const CaretLeftIcon = appIcon(PhCaretLeft, "caret-left")
export const CaretRightIcon = appIcon(PhCaretRight, "caret-right")
export const ChatIcon = appIcon(PhChat, "chat")
export const ChatTextIcon = appIcon(PhChatText, "chat-text")
export const CheckIcon = appIcon(PhCheck, "check")
export const CircleNotchIcon = appIcon(PhCircleNotch, "circle-notch")
export const ClockIcon = appIcon(PhClock, "clock")
export const ConfettiIcon = appIcon(PhConfetti, "confetti")
export const CopyIcon = appIcon(PhCopy, "copy")
export const DotsThreeIcon = appIcon(PhDotsThree, "dots-three")
export const EnvelopeIcon = appIcon(PhEnvelope, "envelope")
export const EyeSlashIcon = appIcon(PhEyeSlash, "eye-slash")
export const FileTextIcon = appIcon(PhFileText, "file-text")
export const FireIcon = appIcon(PhFire, "fire")
export const FlagIcon = appIcon(PhFlag, "flag")
export const FlameIcon = appIcon(PhFlame, "flame")
export const ForkKnifeIcon = appIcon(PhForkKnife, "fork-knife")
export const FunnelSimpleIcon = appIcon(PhFunnelSimple, "funnel-simple")
export const GearIcon = appIcon(PhGear, "gear")
export const GlobeIcon = appIcon(PhGlobe, "globe")
export const GpsFixIcon = appIcon(PhGpsFix, "gps-fix")
export const HouseIcon = appIcon(PhHouse, "house")
export const InfoIcon = appIcon(PhInfo, "info")
export const LifebuoyIcon = appIcon(PhLifebuoy, "lifebuoy")
export const LinkIcon = appIcon(PhLink, "link")
export const ListIcon = appIcon(PhList, "list")
export const ListBulletsIcon = appIcon(PhListBullets, "list-bullets")
export const LockIcon = appIcon(PhLock, "lock")
export const LockKeyIcon = appIcon(PhLockKey, "lock-key")
export const MagnifyingGlassIcon = appIcon(
  PhMagnifyingGlass,
  "magnifying-glass"
)
export const MapPinIcon = appIcon(PhMapPin, "map-pin")
export const MapTrifoldIcon = appIcon(PhMapTrifold, "map-trifold")
export const MegaphoneIcon = appIcon(PhMegaphone, "megaphone")
export const MinusIcon = appIcon(PhMinus, "minus")
export const MoonIcon = appIcon(PhMoon, "moon")
export const NavigationArrowIcon = appIcon(
  PhNavigationArrow,
  "navigation-arrow"
)
export const PaletteIcon = appIcon(PhPalette, "palette")
export const PaperPlaneRightIcon = appIcon(
  PhPaperPlaneRight,
  "paper-plane-right"
)
export const PencilSimpleIcon = appIcon(PhPencilSimple, "pencil-simple")
export const PlusIcon = appIcon(PhPlus, "plus")
export const QuestionIcon = appIcon(PhQuestion, "question")
export const QrCodeIcon = appIcon(PhQrCode, "qr-code")
export const RepeatIcon = appIcon(PhRepeat, "repeat")
export const ScalesIcon = appIcon(PhScales, "scales")
export const ShareNetworkIcon = appIcon(PhShareNetwork, "share-network")
export const ShieldIcon = appIcon(PhShield, "shield")
export const ShieldCheckIcon = appIcon(PhShieldCheck, "shield-check")
export const ShieldWarningIcon = appIcon(PhShieldWarning, "shield-warning")
export const SignOutIcon = appIcon(PhSignOut, "sign-out")
export const SparkleIcon = appIcon(PhSparkle, "sparkle")
export const SunIcon = appIcon(PhSun, "sun")
export const TrashIcon = appIcon(PhTrash, "trash")
export const UploadSimpleIcon = appIcon(PhUploadSimple, "upload-simple")
export const UserIcon = appIcon(PhUser, "user")
export const UserCheckIcon = appIcon(PhUserCheck, "user-check")
export const UserCircleIcon = appIcon(PhUserCircle, "user-circle")
export const UserMinusIcon = appIcon(PhUserMinus, "user-minus")
export const UserPlusIcon = appIcon(PhUserPlus, "user-plus")
export const UsersIcon = appIcon(PhUsers, "users")
export const WarningIcon = appIcon(PhWarning, "warning")
export const WarningCircleIcon = appIcon(PhWarningCircle, "warning-circle")
export const WineIcon = appIcon(PhWine, "wine")
export const XIcon = appIcon(PhX, "x")
export const XCircleIcon = appIcon(PhXCircle, "x-circle")

/** #524: the glyph for each idea icon key (lib/idea-icons.ts). */
export const IDEA_ICONS: Record<IdeaIconKey, Icon> = {
  ball: appIcon(PhSoccerBall, "soccer-ball"),
  bank: appIcon(PhBank, "bank"),
  basket: appIcon(PhBasket, "basket"),
  beer: appIcon(PhBeerStein, "beer-stein"),
  bike: appIcon(PhPersonSimpleBike, "person-simple-bike"),
  binoculars: appIcon(PhBinoculars, "binoculars"),
  bird: appIcon(PhBird, "bird"),
  books: appIcon(PhBooks, "books"),
  bowl: appIcon(PhBowlFood, "bowl-food"),
  bread: appIcon(PhBread, "bread"),
  burger: appIcon(PhHamburger, "hamburger"),
  cake: appIcon(PhCake, "cake"),
  carrot: appIcon(PhCarrot, "carrot"),
  check: appIcon(PhCheckCircle, "check-circle"),
  climb: appIcon(PhHandGrabbing, "hand-grabbing"),
  cocktail: appIcon(PhMartini, "martini"),
  coffee: appIcon(PhCoffee, "coffee"),
  couch: appIcon(PhCouch, "couch"),
  dice: appIcon(PhDiceFive, "dice-five"),
  disco: appIcon(PhDiscoBall, "disco-ball"),
  evergreen: appIcon(PhTreeEvergreen, "tree-evergreen"),
  film: appIcon(PhFilmSlate, "film-slate"),
  flower: appIcon(PhFlower, "flower"),
  house: appIcon(PhHouse, "house"),
  "ice-cream": appIcon(PhIceCream, "ice-cream"),
  leaf: appIcon(PhLeaf, "leaf"),
  "mask-happy": appIcon(PhMaskHappy, "mask-happy"),
  mic: appIcon(PhMicrophoneStage, "microphone-stage"),
  mountains: appIcon(PhMountains, "mountains"),
  music: appIcon(PhMusicNotes, "music-notes"),
  "paint-brush": appIcon(PhPaintBrush, "paint-brush"),
  "ping-pong": appIcon(PhPingPong, "ping-pong"),
  planet: appIcon(PhPlanet, "planet"),
  plant: appIcon(PhPlant, "plant"),
  question: appIcon(PhQuestion, "question"),
  run: appIcon(PhPersonSimpleRun, "person-simple-run"),
  sneaker: appIcon(PhSneaker, "sneaker"),
  snowflake: appIcon(PhSnowflake, "snowflake"),
  sparkle: appIcon(PhSparkle, "sparkle"),
  storefront: appIcon(PhStorefront, "storefront"),
  "sun-horizon": appIcon(PhSunHorizon, "sun-horizon"),
  swap: appIcon(PhArrowsLeftRight, "arrows-left-right"),
  swim: appIcon(PhPersonSimpleSwim, "person-simple-swim"),
  tag: appIcon(PhTag, "tag"),
  "tai-chi": appIcon(PhPersonSimpleTaiChi, "person-simple-tai-chi"),
  tree: appIcon(PhTree, "tree"),
  vinyl: appIcon(PhVinylRecord, "vinyl-record"),
  walk: appIcon(PhPersonSimpleWalk, "person-simple-walk"),
  waves: appIcon(PhWaves, "waves"),
  wind: appIcon(PhWind, "wind"),
}
