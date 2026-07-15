# PromptScore

Multi-user prompt workspace:

- **Normal users** register/log in, pick a use case, submit prompts (saved).
- **Admins** (`jki`, `richa`, `minju`) review submissions and run scoring.
- **Overall score results** are admin-only.

## Run locally

```bash
npm install
npm start
```

Open http://127.0.0.1:5173

### Accounts

| Role  | Usernames              | Default password |
|-------|------------------------|------------------|
| Admin | `jki`, `richa`, `minju` | `admin123`      |
| User  | Register any other name | chosen at signup |

## Notes

GitHub Pages cannot host the API/database. Use `npm start` (or deploy the Node app to a host like Render/Railway).
