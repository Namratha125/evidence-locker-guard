# 🛡️ Evidence Locker Guard  
**Digital Evidence Locker – Secure Forensic Management System**

Evidence Locker Guard is a secure, end-to-end digital repository for **law enforcement, legal professionals, and investigative institutions**. It ensures **authenticity, integrity, and confidentiality** of digital evidence using **chain of custody tracking, automated audit logs, and role-based access control (RBAC)**.

---

## 🚀 Key Features
- **Case Management:** Create, assign, and track investigation cases with priorities and real-time status.
- **Forensic Evidence Vault:** Secure upload of images, documents, and videos with metadata.
- **Chain of Custody:** Tamper-proof tracking of evidence transfers for legal admissibility.
- **Audit Logging:** Automatic system-wide logs via database triggers.
- **RBAC:** Controlled access for Admins, Investigators, Analysts, and Legal professionals.
- **Tagging & Search:** Color-coded tags and efficient case filtering.
- **Collaboration:** Commenting on cases and evidence for investigator coordination.

---

## 🛠️ Tech Stack
- **Frontend:** React 18 (Vite), TypeScript  
- **Backend:** Node.js, Express, JWT Authentication  
- **Database:** MySQL 8.0 (3NF normalized)  
- **Security:** Helmet.js, Bcrypt  

---

## 📊 Database Design
- **Triggers:** Auto UUID generation and audit log creation.
- **Stored Procedures:** Enforce RBAC and secure case creation.
- **Core Tables:** profiles, cases, evidence, tags, chain_of_custody, audit_logs, comments.

---

## ⚙️ Setup

### Database
Run the following SQL files **in order**:
01_tables.sql → 02_triggers.sql → 03_procedures.sql


---

### Backend
```bash
cd backend
npm install
npm start
```

Environment variables (.env)

```bash
DB_HOST=localhost
DB_USER=your_root
DB_PASSWORD=your_password
DB_NAME=evidence_locker
JWT_SECRET=your_secret_key
PORT=5000
```
Frontend
```bash
npm install
npm run dev
```
👥 Team

Namratha A 

Dhatri P Sriram

📜 License

ISC License
