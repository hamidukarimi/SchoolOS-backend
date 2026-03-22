# Contributing to AuthForge Express

First off, thank you for considering contributing 🙌  
We appreciate every contribution — whether it’s reporting a bug, suggesting an improvement, or submitting a pull request.

---

## 🚀 Getting Started

### 1️⃣ Fork the Repository

Click the **Fork** button at the top-right of the repository page.

### 2️⃣ Clone Your Fork

```bash
git clone https://github.com/hamidukarimi/authforge-express.git
cd authforge-express
```
3️⃣ Install Dependencies
```bash
npm install
```
4️⃣ Setup Environment Variables
Create a .env file in the root directory using .env.example as reference.

```bash
cp .env.example .env
```
Update values as needed (MongoDB URI, JWT secrets, etc).

5️⃣ Run the Project
```bash
npm run dev
```
The server should now be running locally.

🛠 How to Contribute
🐛 Reporting Bugs
When opening an issue, please include:

A clear and descriptive title

Steps to reproduce the issue

Expected behavior

Actual behavior

Environment details (Node version, OS, etc.)

💡 Suggesting Features
We welcome feature suggestions!
Please:

Explain the problem your feature solves

Provide a clear description of the proposed solution

Mention any potential alternatives

🔀 Submitting a Pull Request
Create a new branch:

```bash
git checkout -b feature/your-feature-name
```
Make your changes.

Commit clearly and descriptively:

```bash
git commit -m "feat: add X feature"
```
Push your branch:

```bash
git push origin feature/your-feature-name
```
Open a Pull Request to the main branch.

📏 Coding Guidelines
Follow the existing project structure.

Keep controllers thin — business logic belongs in services.

Use ApiError for standardized error handling.

Validate inputs using existing validator patterns.

Keep commits clean and meaningful.

🧪 Testing (Future Scope)
Automated tests are planned for future versions.
Contributors are welcome to help introduce testing (Jest or similar).

📜 Code of Conduct
Please be respectful and constructive in discussions.
We aim to maintain a welcoming and professional open-source environment.

Thank you for helping improve AuthForge Express 💙


---