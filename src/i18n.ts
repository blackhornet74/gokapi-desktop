import type { Language } from "./types";

export type Messages = { [key: string]: string | Messages };

const en: Messages = {
  appName: "Gokapi Desktop",
  tagline: "A dispatch desk for your Gokapi server.",
  loading: "Starting…",
  retry: "Retry",

  wizardTitle: "Connect your server",
  wizardIntro:
    "Enter the address of your Gokapi server and an API key. The key is stored in the operating system credential store and never leaves this computer.",
  serverUrl: "Server URL",
  serverUrlHint: "Example: https://files.example.com",
  apiKey: "API key",
  apiKeyHint: "Create one in Gokapi under API. It needs Upload and View; add Delete to remove files and Logs for last-download times.",
  verify: "Verify connection",
  verifying: "Verifying…",
  verified: "Connection verified",
  verifyFailed: "Could not verify the connection. Check the URL and the API key.",
  serverLimits: "Maximum upload size: {size}",
  e2eWarning:
    "This server uses end-to-end encryption (level 3). The API cannot create those uploads; use the official Gokapi CLI instead.",
  continue: "Continue",
  finish: "Save and start",
  back: "Back",

  defaultsTitle: "Dispatch defaults",
  defaultsHint: "They can be changed for every upload, and later in the settings.",
  archiveTitle: "{count} items selected",
  archiveBody: "Send them as one ZIP archive, or as separate shares?",
  archiveHint: "One ZIP creates a single link. Separate files create one link each.",
  archiveZip: "One ZIP",
  archiveSeparate: "Separate files",
  archivePreparing: "Preparing ZIP…",
  archiveName: "Archive name",
  archiveNameHint: "The .zip extension is added automatically. You can change the name.",
  days: "Expiry",
  downloads: "Downloads",
  password: "Password",
  language: "Language",
  autostart: "Start with the system",
  autostartHint: "The app stays in the tray and checks for updates at startup.",
  noExpiry: "No expiry",
  unlimited: "Unlimited",

  chooseFiles: "Add files…",
  chooseFolder: "Add folder…",
  pasteImage: "Paste image",
  dropTitle: "Drop files to dispatch",
  dropHint: "Folders are zipped before they are sent.",
  pasteEmpty: "The clipboard does not contain an image.",
  composeTitle: "New dispatch",
  queueEmpty: "Nothing in the outbox.",
  optional: "Optional",
  zeroUnlimited: "0 = unlimited",
  daysUnit: "days",
  queueTitle: "Outbox",
  statusQueued: "Queued",
  statusUploading: "Uploading",
  statusDone: "Sent",
  statusFailed: "Failed",
  statusCancelled: "Cancelled",
  cancel: "Cancel",
  cancelAll: "Cancel all",
  clearFinished: "Clear finished",
  progress: "{done} of {total}",
  cancelHint: "Files not uploaded yet will not be published.",

  historyTitle: "Sent",
  historyEmpty: "Links you send are filed here.",
  copy: "Copy link",
  copied: "Link copied",
  removeLocal: "Remove from history",
  deleteRemote: "Delete from server",
  deleteConfirm: "Delete “{name}” from the server? The link will stop working.",
  deleteConfirmTitle: "Delete from server",
  historyLocalOnly: "Removed from the local history only.",
  refresh: "Refresh",
  refreshInterval: "Server refresh",
  refreshIntervalHint: "How often the Sent list reloads from the server.",
  refreshManual: "Manual only",
  syncing: "Syncing…",
  downloadsCount: "{count} downloads",
  downloadOne: "1 download",
  lastDownload: "last {time}",
  neverDownloaded: "never downloaded",
  lastDownloadHint: "Last download requires the Logs permission on the API key.",
  syncWarning: "Sent mirrors the server. Add the View permission to the API key to sync.",
  deletedFromServer: "Deleted from the server.",
  clearHistory: "Clear history",
  clearHistoryConfirm:
    "Remove all links from the local history? Files on the server are not deleted.",
  selectAll: "Select all",
  selectFile: "Select {name}",
  selectedCount: "{count} selected",
  removeSelected: "Remove selected",
  deleteSelected: "Delete selected from server",
  bulkDeleteConfirm:
    "Delete {count} files from the server? Their links will stop working.",
  bulkDeleted: "Deleted {count} files from the server.",
  bulkDeletePartial: "Deleted {deleted}. Not deleted: {failed}.",

  settings: "Settings",
  connection: "Connection",
  serverInfo: "Server",
  keyPresent: "API key saved ({source})",
  keyMissing: "No API key saved",
  replaceKey: "New API key (leave blank to keep the current one)",
  save: "Save",
  saved: "Saved",
  close: "Close",
  updates: "Updates",
  checkUpdates: "Check for updates",
  checking: "Checking…",
  upToDate: "You are on the latest version.",
  updateAvailable: "Version {version} is available.",
  updateNow: "Update and restart",
  later: "Later",
  downloading: "Downloading update…",
  restarting: "Restarting…",
  updateFailed: "The update could not be installed. The current version keeps working.",
  version: "Version {version}",
  openPortal: "Open portal",
  quit: "Quit",

  keyringFallbackTitle: "System credential store unavailable",
  keyringFallbackBody:
    "The operating system keyring is not available. Save the API key in a local file with restricted permissions instead?",
  keyringFallbackAccept: "Save to file",
  sourceKeyring: "system keyring",
  sourceFile: "local file",

  notifyDoneTitle: "Upload complete",
  notifyDoneBody: "{count} link(s) copied to the clipboard.",

  errors: {
    invalid_url: "The server URL is not valid.",
    unauthorized: "The API key was rejected or lacks the required permission.",
    forbidden: "The server denied the operation.",
    not_found: "The server resource was not found.",
    file_too_large: "The file exceeds the server upload limit.",
    e2e_required: "The server uses end-to-end encryption; use the official Gokapi CLI.",
    network: "Network error. Check the server address and your connection.",
    server: "The server returned an error.",
    invalid_response: "The server response was not understood.",
    cancelled: "Upload cancelled.",
    keyring_unavailable: "The system credential store is unavailable.",
    io: "A local file could not be read or written.",
    unsupported: "This operation is not supported.",
    timeout: "The request timed out.",
    unknown: "Something went wrong.",
    clipboard: "Could not copy to the clipboard.",
  },
} as const;

const it: Messages = {
  appName: "Gokapi Desktop",
  tagline: "Un banco di invio per il tuo server Gokapi.",
  loading: "Avvio in corso…",
  retry: "Riprova",

  wizardTitle: "Collega il server",
  wizardIntro:
    "Inserisci l'indirizzo del tuo server Gokapi e una chiave API. La chiave viene salvata nell'archivio credenziali del sistema e non lascia questo computer.",
  serverUrl: "URL del server",
  serverUrlHint: "Esempio: https://files.example.com",
  apiKey: "Chiave API",
  apiKeyHint: "Creane una in Gokapi, sezione API. Servono Upload e View; aggiungi Delete per eliminare i file e Logs per l'ultimo download.",
  verify: "Verifica connessione",
  verifying: "Verifica in corso…",
  verified: "Connessione verificata",
  verifyFailed: "Impossibile verificare la connessione. Controlla URL e chiave API.",
  serverLimits: "Dimensione massima di upload: {size}",
  e2eWarning:
    "Questo server usa la cifratura end-to-end (livello 3). L'API non può creare questi upload; usa il client ufficiale Gokapi.",
  continue: "Continua",
  finish: "Salva e avvia",
  back: "Indietro",

  defaultsTitle: "Predefiniti di invio",
  defaultsHint: "Puoi cambiarli per ogni upload e in seguito nelle impostazioni.",
  archiveTitle: "{count} elementi selezionati",
  archiveBody: "Inviarli come un unico archivio ZIP o come condivisioni separate?",
  archiveHint: "Un solo ZIP crea un link unico. I file separati creano un link ciascuno.",
  archiveZip: "Un solo ZIP",
  archiveSeparate: "File separati",
  archivePreparing: "Creazione ZIP…",
  archiveName: "Nome archivio",
  archiveNameHint: "L'estensione .zip viene aggiunta automaticamente. Puoi cambiare il nome.",
  days: "Scadenza",
  downloads: "Download",
  password: "Password",
  language: "Lingua",
  autostart: "Avvia con il sistema",
  autostartHint: "L'app resta nella tray e controlla gli aggiornamenti all'avvio.",
  noExpiry: "Nessuna scadenza",
  unlimited: "Illimitati",

  chooseFiles: "Aggiungi file…",
  chooseFolder: "Aggiungi cartella…",
  pasteImage: "Incolla immagine",
  dropTitle: "Trascina i file da inviare",
  dropHint: "Le cartelle vengono compresse prima dell'invio.",
  pasteEmpty: "Gli appunti non contengono un'immagine.",
  composeTitle: "Nuovo invio",
  queueEmpty: "Nessun invio in coda.",
  optional: "Opzionale",
  zeroUnlimited: "0 = illimitati",
  daysUnit: "giorni",
  queueTitle: "In uscita",
  statusQueued: "In coda",
  statusUploading: "Caricamento",
  statusDone: "Inviato",
  statusFailed: "Non riuscito",
  statusCancelled: "Annullato",
  cancel: "Annulla",
  cancelAll: "Annulla tutto",
  clearFinished: "Pulisci completati",
  progress: "{done} di {total}",
  cancelHint: "I file non ancora inviati non verranno pubblicati.",

  historyTitle: "Inviati",
  historyEmpty: "I link inviati finiscono qui.",
  copy: "Copia link",
  copied: "Link copiato",
  removeLocal: "Rimuovi dalla cronologia",
  deleteRemote: "Elimina dal server",
  deleteConfirm: "Eliminare “{name}” dal server? Il link non funzionerà più.",
  deleteConfirmTitle: "Elimina dal server",
  historyLocalOnly: "Rimosso solo dalla cronologia locale.",
  refresh: "Aggiorna",
  refreshInterval: "Aggiornamento dal server",
  refreshIntervalHint: "Ogni quanto ricaricare Inviati dal server.",
  refreshManual: "Solo manuale",
  syncing: "Sincronizzazione…",
  downloadsCount: "{count} download",
  downloadOne: "1 download",
  lastDownload: "ultimo {time}",
  neverDownloaded: "mai scaricato",
  lastDownloadHint: "L''ultimo download richiede il permesso Logs sulla chiave API.",
  syncWarning: "Inviati riflette il server. Aggiungi il permesso View alla chiave API per sincronizzare.",
  deletedFromServer: "Eliminato dal server.",
  clearHistory: "Svuota cronologia",
  clearHistoryConfirm:
    "Rimuovere tutti i link dalla cronologia locale? I file sul server non vengono eliminati.",
  selectAll: "Seleziona tutto",
  selectFile: "Seleziona {name}",
  selectedCount: "{count} selezionati",
  removeSelected: "Rimuovi selezionati",
  deleteSelected: "Elimina selezionati dal server",
  bulkDeleteConfirm: "Eliminare {count} file dal server? I link smetteranno di funzionare.",
  bulkDeleted: "Eliminati {count} file dal server.",
  bulkDeletePartial: "Eliminati {deleted}. Non eliminati: {failed}.",

  settings: "Impostazioni",
  connection: "Connessione",
  serverInfo: "Server",
  keyPresent: "Chiave API salvata ({source})",
  keyMissing: "Nessuna chiave API salvata",
  replaceKey: "Nuova chiave API (lascia vuoto per mantenere quella attuale)",
  save: "Salva",
  saved: "Salvato",
  close: "Chiudi",
  updates: "Aggiornamenti",
  checkUpdates: "Controlla aggiornamenti",
  checking: "Controllo in corso…",
  upToDate: "Hai già l'ultima versione.",
  updateAvailable: "La versione {version} è disponibile.",
  updateNow: "Aggiorna e riavvia",
  later: "Più tardi",
  downloading: "Download dell'aggiornamento…",
  restarting: "Riavvio…",
  updateFailed: "Impossibile installare l'aggiornamento. La versione attuale continua a funzionare.",
  version: "Versione {version}",
  openPortal: "Apri portale",
  quit: "Esci",

  keyringFallbackTitle: "Archivio credenziali non disponibile",
  keyringFallbackBody:
    "Il keyring di sistema non è disponibile. Salvare la chiave API in un file locale con permessi ristretti?",
  keyringFallbackAccept: "Salva su file",
  sourceKeyring: "keyring di sistema",
  sourceFile: "file locale",

  notifyDoneTitle: "Upload completato",
  notifyDoneBody: "{count} link copiati negli appunti.",

  errors: {
    invalid_url: "L'URL del server non è valido.",
    unauthorized: "La chiave API è stata rifiutata o non ha il permesso necessario.",
    forbidden: "Il server ha negato l'operazione.",
    not_found: "La risorsa richiesta non esiste sul server.",
    file_too_large: "Il file supera il limite di upload del server.",
    e2e_required: "Il server usa la cifratura end-to-end; usa il client ufficiale Gokapi.",
    network: "Errore di rete. Controlla l'indirizzo del server e la connessione.",
    server: "Il server ha restituito un errore.",
    invalid_response: "La risposta del server non è stata compresa.",
    cancelled: "Caricamento annullato.",
    keyring_unavailable: "L'archivio credenziali di sistema non è disponibile.",
    io: "Impossibile leggere o scrivere un file locale.",
    unsupported: "Operazione non supportata.",
    timeout: "La richiesta è scaduta.",
    unknown: "Si è verificato un errore.",
    clipboard: "Impossibile copiare negli appunti.",
  },
};

export const dictionaries: Record<Language, Messages> = { en, it };

export type TranslationKey = string;

export function translate(language: Language, key: string, values?: Record<string, string | number>): string {
  const parts = key.split(".");
  let node: unknown = dictionaries[language];
  for (const part of parts) {
    if (typeof node !== "object" || node === null) return key;
    node = (node as Record<string, unknown>)[part];
  }
  let text = typeof node === "string" ? node : key;
  if (values) {
    for (const [name, value] of Object.entries(values)) {
      text = text.replaceAll(`{${name}}`, String(value));
    }
  }
  return text;
}

export function formatBytes(value: number): string {
  if (!Number.isFinite(value) || value < 0) return "—";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = value;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  const digits = size >= 100 || unit === 0 ? 0 : size >= 10 ? 1 : 2;
  return `${size.toFixed(digits)} ${units[unit]}`;
}
