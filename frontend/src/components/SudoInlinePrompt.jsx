import { useEffect, useRef, useState } from 'react';

// سطر باسورد النظام داخل الترمنال نفسه — زي الترمنال الحقيقي.
// الباسورد لا يُحفَظ في أي مكان: state محلي فقط ويُمسح فور الإرسال/الإلغاء.
export default function SudoInlinePrompt({ preview, onSubmit, onCancel }) {
  const [password, setPassword] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const clearAnd = (fn, value) => {
    setPassword('');
    if (inputRef.current) inputRef.current.value = '';
    fn?.(value);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!password) return;
    const pw = password;
    clearAnd(onSubmit, pw);
  };

  return (
    <div className="terminal-block sudo-inline">
      <div className="terminal-cmd">
        <span>$ {preview}</span>
      </div>
      <form className="sudo-inline-form" onSubmit={handleSubmit}>
        <span className="sudo-inline-label">[sudo] password:</span>
        <input
          ref={inputRef}
          type="password"
          dir="ltr"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          aria-label="باسورد النظام"
          autoComplete="off"
        />
        <button type="submit" disabled={!password}>تنفيذ</button>
        <button type="button" onClick={() => clearAnd(onCancel)}>إلغاء</button>
      </form>
      <p className="text-muted sudo-inline-note">🔒 لا يُحفَظ — يُمسح فور استخدامه</p>
    </div>
  );
}
