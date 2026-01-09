import { createSignal } from 'solid-js';
import { auth } from './firebase';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from "firebase/auth";
import './App.css';

function App() {
  const [email, setEmail] = createSignal("");
  const [password, setPassword] = createSignal("");
  const [message, setMessage] = createSignal("");
  const [user, setUser] = createSignal(null);

  // Funktion für Registrierung und Login
  const handleAuth = async (type) => {
    setMessage("Lade...");
    try {
      if (type === 'register') {
        const res = await createUserWithEmailAndPassword(auth, email(), password());
        setUser(res.user);
        setMessage("Konto erfolgreich erstellt!");
      } else {
        const res = await signInWithEmailAndPassword(auth, email(), password());
        setUser(res.user);
        setMessage("Erfolgreich eingeloggt!");
      }
    } catch (error) {
      setMessage(`Fehler: ${error.message}`);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    setUser(null);
    setMessage("Ausgeloggt.");
  };

  return (
    <div class="container">
      <h1>Lumina Foto App</h1>
      
      {!user() ? (
        <div class="card">
          <h3>Login oder Registrierung</h3>
          <input 
            type="email" 
            placeholder="E-Mail" 
            onInput={(e) => setEmail(e.currentTarget.value)} 
          />
          <input 
            type="password" 
            placeholder="Passwort (min. 6 Zeichen)" 
            onInput={(e) => setPassword(e.currentTarget.value)} 
          />
          <div class="button-group">
            <button onClick={() => handleAuth('login')}>Login</button>
            <button onClick={() => handleAuth('register')} class="secondary">Registrieren</button>
          </div>
        </div>
      ) : (
        <div class="card">
          <p>Angemeldet als: <strong>{user().email}</strong></p>
          <button onClick={handleLogout} class="danger">Ausloggen</button>
          
          <div style={{ "margin-top": "20px", "border-top": "1px solid #ccc", "padding-top": "10px" }}>
            <p>📸 Kamera-Modul kommt im nächsten Schritt!</p>
          </div>
        </div>
      )}

      {message() && <p class="status-message">{message()}</p>}
    </div>
  );
}

export default App;