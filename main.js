const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');

const app = express();
const port = 3000;

// Supabase-Client initialisieren
const supabaseUrl = 'https://scraizustvtatsasfbrd.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNjcmFpenVzdHZ0YXRzYXNmYnJkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzUxNjYwNDgsImV4cCI6MjA1MDc0MjA0OH0.JyfsTmWoLwwMRWOuMBf26QtRvSb9ANmtNLbxTjWjIZc';
const supabase = createClient(supabaseUrl, supabaseKey);

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Statische Dateien bereitstellen (aus dem public-Ordner)
app.use(express.static(path.join(__dirname, 'public'))); // Statische Dateien aus dem public-Ordner bereitstellen

// API-Endpunkte
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;

    // Überprüfung des Benutzers
    const { data: user, error } = await supabase
        .from('users')
        .select('*')
        .eq('username', username)
        .eq('password', password) // In einer echten Anwendung solltest du das Passwort hashen
        .single();

    if (error || !user) {
        return res.status(401).json({ success: false, message: 'Ungültige Anmeldedaten' });
    }

    res.json({ success: true, user });
});

// API-Endpunkt für Neuigkeiten
app.get('/api/news', async (req, res) => {
    const { user } = req.query;

    if (!user) {
        return res.status(400).json({ content: "Benutzername ist erforderlich." });
    }

    const { data: userData, error } = await supabase
        .from('users')
        .select('news')
        .eq('username', user)
        .single();

    if (error || !userData) {
        return res.status(500).json({ content: "Fehler beim Abrufen der Neuigkeiten." });
    }

    // Sicherstellen, dass die Neuigkeiten als Array zurückgegeben werden
    const newsArray = userData.news || [];
    res.json({ content: newsArray });
});



// API-Endpunkt für Anmerkungen
app.get('/api/notes', async (req, res) => {
    const { user } = req.query;

    if (!user) {
        return res.status(400).json({ content: "Benutzername ist erforderlich." });
    }

    const { data: userData, error } = await supabase
        .from('users')
        .select('annotations')
        .eq('username', user)
        .single();

    if (error || !userData) {
        return res.status(500).json({ content: "Fehler beim Abrufen der Anmerkungen." });
    }

    res.json({ content: userData.annotations || [] });
});


// API-Endpunkt für Jobs
app.get('/api/jobs', async (req, res) => {
    const username = req.query.user;

    try {
        // Zuerst die Benutzer-ID aus dem Benutzernamen abfragen
        const { data: userData, error: userError } = await supabase
            .from('users')
            .select('id')
            .eq('username', username)
            .single();

        if (userError || !userData) {
            return res.status(404).json({ message: "Benutzer nicht gefunden." });
        }

        const userId = userData.id;

        // Nun die Jobs des Benutzers abfragen
        const { data: jobsData, error: jobsError } = await supabase
            .from('user_jobs')
            .select('jobs(name)') // Hier wird angenommen, dass 'jobs' die Job-Tabelle ist und der Name des Jobs abgefragt wird.
            .eq('user_id', userId); // REMOVE .single() to allow for multiple rows

        if (jobsError) {
            console.error("Fehler beim Abrufen der Jobs:", jobsError);
            return res.status(500).json({ message: "Fehler beim Abrufen der Jobs." });
        }

        // Die Liste der Jobs zurückgeben
        const jobs = jobsData.map(job => ({ jobs: job.jobs.name })); // Hier den Jobnamen aus dem Resultat extrahieren
        res.json(jobs);
    } catch (error) {
        console.error("Fehler beim Abrufen der Jobs:", error);
        res.status(500).json({ message: "Fehler beim Abrufen der Jobs." });
    }
});



// API-Endpunkt für das Abrufen von Aufgaben
app.get('/api/tasks', async (req, res) => {
    const { user } = req.query;

    if (!user) {
        return res.status(400).json({ message: "Benutzername ist erforderlich." });
    }

    // Benutzer-ID abrufen
    const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id')
        .eq('username', user)
        .single();

    if (userError || !userData) {
        return res.status(404).json({ message: "Benutzer nicht gefunden." });
    }

    const userId = userData.id;

    // Aufgaben abrufen, einschließlich Priorität
    const { data: tasks, error } = await supabase
        .from('tasks')
        .select('id, title, details, completed, created_at, priority, drive_link') // Felder auswählen
        .eq('user_id', userId)
        .order('created_at', { ascending: true });

    if (error) {
        return res.status(500).json({ message: "Fehler beim Abrufen der Aufgaben." });
    }

    

    res.json(tasks);
});

// API-Endpunkt für das Markieren einer Aufgabe als erledigt
app.post('/api/completeTask', async (req, res) => {
    const { taskId } = req.body;

    if (!taskId) {
        return res.status(400).json({ message: "Task ID ist erforderlich." });
    }

    const { error } = await supabase
        .from('tasks')
        .update({ completed: true })
        .eq('id', taskId);

    if (error) {
        return res.status(500).json({ message: "Fehler beim Aktualisieren der Aufgabe." });
    }

    res.json({ message: "Aufgabe erfolgreich als erledigt markiert." });
});


// API-Endpunkt für das Rückgängigmachen einer Aufgabe
app.post('/api/undoTask', async (req, res) => {
    const { taskId } = req.body;

    if (!taskId) {
        return res.status(400).json({ message: "Task ID ist erforderlich." });
    }

    try {
        // Zurücksetzen der Aufgabe in der Datenbank
        const { error } = await supabase
            .from('tasks')
            .update({ completed: false })
            .eq('id', taskId);

        if (error) {
            throw error;
        }

        res.json({ message: "Aufgabe erfolgreich zurückgesetzt." });
    } catch (err) {
        console.error("Fehler beim Zurücksetzen der Aufgabe:", err);
        res.status(500).json({ message: "Fehler beim Zurücksetzen der Aufgabe." });
    }
});







// Route für die Hauptseite (index.html)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html')); // Hauptseite
});

// Server starten
app.listen(port, () => {
    console.log(`Server läuft auf http://localhost:${port}`);
});
