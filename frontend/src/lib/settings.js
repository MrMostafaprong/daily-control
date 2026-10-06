// قراءة إعدادات الواجهة من مكان واحد — بدل تكرار JSON.parse في كل صفحة
export const SETTINGS_KEY = 'daily-control-settings';

export const DEFAULT_SETTINGS = {
  themeFamily: 'slate',
  themeMode: 'dark',
  refreshModels: true,
  confirmTerminal: true,
  confirmGithubDelete: true,
  defaultPrivateRepo: true,
  defaultCommitMessage: 'تعديل من Daily Control',
};

export function readSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
    return {
      ...DEFAULT_SETTINGS,
      ...saved,
      themeFamily: saved.themeFamily || 'slate',
      themeMode: saved.themeMode || (saved.theme === 'light' ? 'light' : 'dark'),
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function writeSettings(settings) {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch { /* storage blocked */ }
}
