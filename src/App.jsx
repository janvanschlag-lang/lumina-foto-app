import { createSignal, onMount } from 'solid-js';
import { auth } from './firebase';
import { 
  onAuthStateChanged, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut 
} from "firebase/auth";
import './App.css';

function App() {
  const [email, setEmail] = createSignal("");
  const [password, setPassword] = createSignal("");
  const [message, setMessage] = createSignal("");
  const [user, setUser] = createSignal(null);
  const [isLoading, setIsLoading] = createSignal(true);

  onMount(() => {
    // Falls Firebase zu lange braucht, erzwingen wir das Ende des Ladebildschirms nach 2 Sek.
    const fallbackTimeout = setTimeout(() => setIsLoading(false), 2000);

    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      clearTimeout(fallbackTimeout);
      setUser(firebaseUser);
      setIsLoading(false);
    });
    
    return () => unsubscribe();
  });

  const handleAuth = async (type) => {
    setMessage("Verarbeite...");
    try {
      let res;
      if (type === 'register') {
        res = await createUserWithEmailAndPassword(auth, email(), password());
      } else {
        res = await signInWithEmailAndPassword(auth, email(), password());
      }
      setUser(res.user);
      setMessage("");
    } catch (error) {
      setMessage(`Fehler: ${error.message}`);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setUser(null);
      setMessage("Ausgeloggt.");
    } catch (error) {
      setMessage("Fehler beim Abmelden.");
    }
  };

  return (
    <div class="container">
      <h1>Lumina</h1>
      
      {isLoading() ? (
        <p>Lade App-Daten...</p>
      ) : (
        <>
          {!user() ? (
            <div class="card">
              <h3>Anmelden</h3>
              <input 
                type="email" 
                placeholder="E-Mail" 
                onInput={(e) => setEmail(e.currentTarget.value)} 
              />
              <input 
                type="password" 
                placeholder="Passwort" 
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
              
              <div style={{ 
                "margin": "30px 0", 
                "padding": "20px", 
                "border": "2px dashed #ccc",
                "background": "#fff",
                "color": "#000"
              }}>
                <p>Bereit für dein Konzept!</p>
              </div>

              <button onClick={handleLogout} class="danger">Ausloggen</button>
            </div>
          )}
        </>
      )}

      {message() && <p class="status-message">{message()}</p>}
    </div>
  );
}

export default App;