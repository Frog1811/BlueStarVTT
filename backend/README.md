# Backend MySQL

This folder contains a minimal MySQL connection for the local `DNDTool` database.

## Database setup (PowerShell)

```powershell
# Connect to MySQL as root.
mysql -u root -p

# In the MySQL prompt, run:
CREATE DATABASE DNDTool;
CREATE USER 'root'@'localhost' IDENTIFIED BY 'BlueStar6321';
GRANT ALL PRIVILEGES ON DNDTool.* TO 'root'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

## Environment

Create `backend/.env`:

```dotenv
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=BlueStar6321
MYSQL_DATABASE=DNDTool
```

## Quick start

```powershell
cd C:\xampp\htdocs\BlueMusic\backend
npm install
npm start
```

You should see a message confirming MySQL is ready and the `metadata` table exists.

## Migrations

Place migration SQL files in `backend/Migration/`. A starter file is included:

- `backend/Migration/001_create_metadata.sql`
- `backend/Migration/003_create_users.sql`
- `backend/Migration/004_create_campaigns.sql`

## API

Start the API server (default `http://localhost:3001`) with:

```powershell
npm start
```

Endpoints:

- `POST /api/register` `{ username, email, password }`
- `POST /api/login` `{ email, password }`
- `POST /api/campaigns` `{ name, dungeonMasterId }`
- `GET /api/users/:userId/campaigns`

## Connection defaults

The backend uses these defaults unless you set environment variables:

- Host: `localhost` (`MYSQL_HOST`)
- Port: `3306` (`MYSQL_PORT`)
- User: `root` (`MYSQL_USER`)
- Password: `BlueStar6321` (`MYSQL_PASSWORD`)
- Database: `DNDTool` (`MYSQL_DATABASE`)
