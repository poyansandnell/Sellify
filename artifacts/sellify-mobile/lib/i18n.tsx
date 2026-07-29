import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type Language = 'sv' | 'en';

const sv = {
  tabHome: 'Hem',
  tabSell: 'Sälj',
  tabMessages: 'Meddelanden',
  tabListings: 'Annonser',
  tabProfile: 'Profil',

  searchPlaceholder: 'Sök produkter, märken...',
  categories: 'Kategorier',
  newest: 'Senaste',
  nearby: 'Nära dig',
  viewAll: 'Visa alla',
  results: 'resultat',
  noResults: 'Inga annonser hittades',
  tryOtherSearch: 'Prova en annan sökning eller kategori.',

  sold: 'Såld',
  draft: 'Utkast',
  active: 'Aktiv',
  negotiable: 'Prisförslag',
  description: 'Beskrivning',
  specifications: 'Specifikationer',
  condition: 'Skick',
  shipping: 'Leverans',
  shippingPickup: 'Hämtas',
  shippingShip: 'Skickas',
  shippingBoth: 'Hämtas eller skickas',
  seller: 'Säljare',
  memberSince: 'Medlem sedan',
  similar: 'Liknande annonser',
  sendMessage: 'Skicka meddelande',
  messagePlaceholder: 'Hej! Är den fortfarande tillgänglig?',
  send: 'Skicka',
  views: 'visningar',
  signInToChat: 'Logga in för att chatta med säljaren',
  yourListing: 'Detta är din annons',

  sellTitle: 'Sälj en pryl',
  sellSubtitle: 'Fota din pryl så skriver AI:n annonsen åt dig',
  addPhotos: 'Lägg till foton',
  takePhoto: 'Ta foto',
  fromLibrary: 'Välj från biblioteket',
  analyzing: 'AI:n analyserar dina foton...',
  analyzingHint: 'Skapar titel, beskrivning och prisförslag',
  reviewTitle: 'Granska annonsen',
  reviewSubtitle: 'AI-förslag – tryck för att ändra',
  aiSuggestion: 'AI-förslag',
  titleLabel: 'Titel',
  priceLabel: 'Pris',
  cityLabel: 'Stad',
  publish: 'Publicera',
  publishing: 'Publicerar...',
  published: 'Din annons är publicerad!',
  uploadFailed: 'Uppladdningen misslyckades, försök igen',
  uploadStepRequestUrl: 'Begära uppladdningslänk',
  uploadStepPut: 'Ladda upp bilden',
  uploadStepAnalyze: 'AI-analysen',
  uploadStepPublish: 'Publicera annonsen',
  signInToSell: 'Logga in för att sälja',
  signInToSellText: 'Du behöver ett konto för att lägga upp annonser.',
  continueBtn: 'Fortsätt',
  uploading: 'Laddar upp foton...',
  extraInfoTitle: 'Berätta mer om din pryl',
  extraInfoHint: 'T.ex. är den original? Hur länge har du haft den? Kvitto? Reg.nr?',
  extraInfoPlaceholder: 'Skriv detaljer här, eller tryck på mikrofonen och prata...',
  tapToTalk: 'Tryck och prata',
  recordingTap: 'Spelar in – tryck för att stoppa',
  transcribing: 'Tolkar din röst...',
  micFailed: 'Kunde inte spela in, prova att skriva istället',
  aiQuestions: 'AI:n undrar',
  updateWithAi: 'Uppdatera annonsen med AI',
  updatingWithAi: 'Uppdaterar annonsen...',

  messagesTitle: 'Meddelanden',
  noMessages: 'Inga meddelanden än',
  noMessagesText: 'När du kontaktar en säljare eller får frågor om dina annonser visas de här.',
  signInToSeeMessages: 'Logga in för att se dina meddelanden',
  writeMessage: 'Skriv ett meddelande...',

  myListings: 'Mina annonser',
  createListing: 'Skapa annons',
  aiUpdated: 'Texten är uppdaterad med dina detaljer',
  cityRequired: 'Fyll i vilken stad du finns i innan du publicerar',
  deleteAccount: 'Radera konto',
  deleteAccountWarning:
    'Ditt konto, dina annonser, meddelanden och favoriter raderas permanent. Detta går inte att ångra.',
  deleteAccountConfirm: 'Radera permanent',
  continueWithApple: 'Fortsätt med Apple',
  copyListingTitle: 'Skapa liknande annons',
  copyListingReplace: 'Du har en påbörjad annons. Vill du ersätta den med en kopia?',
  copyListingConfirm: 'Ersätt',
  noListings: 'Inga annonser än',
  noListingsText: 'Tryck på Sälj för att lägga upp din första annons.',
  markSold: 'Markera som såld',
  delete: 'Ta bort',
  deleteConfirm: 'Vill du ta bort annonsen?',
  cancel: 'Avbryt',
  back: 'Bakåt',
  stats: 'Statistik',
  favoritesCount: 'favoriter',
  signInToSeeListings: 'Logga in för att se dina annonser',

  profile: 'Profil',
  favorites: 'Favoriter',
  noFavorites: 'Inga favoriter än',
  noFavoritesText: 'Tryck på hjärtat på en annons för att spara den här.',
  language: 'Språk',
  swedish: 'Svenska',
  english: 'Engelska',
  signIn: 'Logga in',
  signOut: 'Logga ut',
  signUp: 'Skapa konto',
  activeListings: 'aktiva annonser',
  soldListings: 'sålda',
  signInHero: 'Logga in till Sellify',
  signInSub: 'Köp och sälj enkelt',
  email: 'E-postadress',
  password: 'Lösenord',
  continueWithGoogle: 'Fortsätt med Google',
  or: 'eller',
  noAccount: 'Har du inget konto?',
  hasAccount: 'Har du redan ett konto?',
  verifyCode: 'Ange koden vi skickade till din e-post',
  verify: 'Verifiera',
  loading: 'Laddar...',
  error: 'Något gick fel',
  retry: 'Försök igen',
  you: 'Du',
};

const en: typeof sv = {
  tabHome: 'Home',
  tabSell: 'Sell',
  tabMessages: 'Messages',
  tabListings: 'Listings',
  tabProfile: 'Profile',

  searchPlaceholder: 'Search products, brands...',
  categories: 'Categories',
  newest: 'Newest',
  nearby: 'Near you',
  viewAll: 'View all',
  results: 'results',
  noResults: 'No listings found',
  tryOtherSearch: 'Try another search or category.',

  sold: 'Sold',
  draft: 'Draft',
  active: 'Active',
  negotiable: 'Negotiable',
  description: 'Description',
  specifications: 'Specifications',
  condition: 'Condition',
  shipping: 'Delivery',
  shippingPickup: 'Pickup',
  shippingShip: 'Ships',
  shippingBoth: 'Pickup or shipping',
  seller: 'Seller',
  memberSince: 'Member since',
  similar: 'Similar listings',
  sendMessage: 'Send message',
  messagePlaceholder: 'Hi! Is it still available?',
  send: 'Send',
  views: 'views',
  signInToChat: 'Sign in to chat with the seller',
  yourListing: 'This is your listing',

  sellTitle: 'Sell an item',
  sellSubtitle: 'Snap photos and AI writes the listing for you',
  addPhotos: 'Add photos',
  takePhoto: 'Take photo',
  fromLibrary: 'Choose from library',
  analyzing: 'AI is analyzing your photos...',
  analyzingHint: 'Creating title, description and price suggestion',
  reviewTitle: 'Review listing',
  reviewSubtitle: 'AI suggestions – tap to edit',
  aiSuggestion: 'AI suggestion',
  titleLabel: 'Title',
  priceLabel: 'Price',
  cityLabel: 'City',
  publish: 'Publish',
  publishing: 'Publishing...',
  published: 'Your listing is live!',
  uploadFailed: 'Upload failed, please try again',
  uploadStepRequestUrl: 'Requesting upload link',
  uploadStepPut: 'Uploading the image',
  uploadStepAnalyze: 'AI analysis',
  uploadStepPublish: 'Publishing the listing',
  signInToSell: 'Sign in to sell',
  signInToSellText: 'You need an account to post listings.',
  continueBtn: 'Continue',
  uploading: 'Uploading photos...',
  extraInfoTitle: 'Tell us more about your item',
  extraInfoHint: 'E.g. is it original? How long have you owned it? Receipt? Reg. number?',
  extraInfoPlaceholder: 'Type details here, or tap the mic and talk...',
  tapToTalk: 'Tap to talk',
  recordingTap: 'Recording – tap to stop',
  transcribing: 'Transcribing your voice...',
  micFailed: "Couldn't record, try typing instead",
  aiQuestions: 'The AI wonders',
  updateWithAi: 'Update listing with AI',
  updatingWithAi: 'Updating listing...',

  messagesTitle: 'Messages',
  noMessages: 'No messages yet',
  noMessagesText: 'When you contact a seller or get questions about your listings they appear here.',
  signInToSeeMessages: 'Sign in to see your messages',
  writeMessage: 'Write a message...',

  myListings: 'My listings',
  createListing: 'Create listing',
  aiUpdated: 'The text was updated with your details',
  cityRequired: 'Please enter your city before publishing',
  deleteAccount: 'Delete account',
  deleteAccountWarning:
    'Your account, listings, messages and favorites will be permanently deleted. This cannot be undone.',
  deleteAccountConfirm: 'Delete permanently',
  continueWithApple: 'Continue with Apple',
  copyListingTitle: 'Create similar listing',
  copyListingReplace: 'You have a listing in progress. Replace it with a copy?',
  copyListingConfirm: 'Replace',
  noListings: 'No listings yet',
  noListingsText: 'Tap Sell to post your first listing.',
  markSold: 'Mark as sold',
  delete: 'Delete',
  deleteConfirm: 'Delete this listing?',
  cancel: 'Cancel',
  back: 'Back',
  stats: 'Stats',
  favoritesCount: 'favorites',
  signInToSeeListings: 'Sign in to see your listings',

  profile: 'Profile',
  favorites: 'Favorites',
  noFavorites: 'No favorites yet',
  noFavoritesText: 'Tap the heart on a listing to save it here.',
  language: 'Language',
  swedish: 'Swedish',
  english: 'English',
  signIn: 'Sign in',
  signOut: 'Sign out',
  signUp: 'Create account',
  activeListings: 'active listings',
  soldListings: 'sold',
  signInHero: 'Sign in to Sellify',
  signInSub: 'Buy and sell easily',
  email: 'Email address',
  password: 'Password',
  continueWithGoogle: 'Continue with Google',
  or: 'or',
  noAccount: "Don't have an account?",
  hasAccount: 'Already have an account?',
  verifyCode: 'Enter the code we sent to your email',
  verify: 'Verify',
  loading: 'Loading...',
  error: 'Something went wrong',
  retry: 'Retry',
  you: 'You',
};

export type Dictionary = typeof sv;
const dictionaries: Record<Language, Dictionary> = { sv, en };

interface I18nContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: Dictionary;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>('sv');

  useEffect(() => {
    AsyncStorage.getItem('sellify-lang').then((saved) => {
      if (saved === 'sv' || saved === 'en') setLanguageState(saved);
    });
  }, []);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    AsyncStorage.setItem('sellify-lang', lang);
  };

  return (
    <I18nContext.Provider
      value={{ language, setLanguage, t: dictionaries[language] }}
    >
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within I18nProvider');
  return ctx;
}

export function conditionLabel(condition: string, lang: Language): string {
  const map: Record<string, [string, string]> = {
    new: ['Ny', 'New'],
    like_new: ['Som ny', 'Like new'],
    good: ['Bra skick', 'Good'],
    fair: ['Okej skick', 'Fair'],
    worn: ['Sliten', 'Worn'],
  };
  const entry = map[condition];
  if (!entry) return condition;
  return lang === 'sv' ? entry[0] : entry[1];
}
