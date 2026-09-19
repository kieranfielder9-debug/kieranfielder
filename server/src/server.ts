import { createDb } from './db';
import { createApp } from './app';

const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;
const DB_PATH = process.env.DB_PATH ?? 'data.sqlite';

const db = createDb(DB_PATH);
const app = createApp(db);

app.listen(PORT, () => {
  console.log(`Storehouse API listening on http://localhost:${PORT}`);
});
