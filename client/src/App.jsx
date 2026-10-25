
import { useEffect, useCallback, useState } from "react";
import "./App.css";

const API = "http://localhost:5000/api";

function App() {
  const [token, setToken] = useState(
    () => localStorage.getItem("taskflow_token") || ""
  );

  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("taskflow_user") || "null");
    } catch {
      return null;
    }
  });

  const [mode, setMode] = useState("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [tasks, setTasks] = useState([]);
  const [users, setUsers] = useState([]);

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("General");
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState("Medium");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [priorityFilter, setPriorityFilter] = useState("All");

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const isAdmin = user?.role === "Admin";

  // API request helper
  const request = useCallback(
    async (path, options = {}) => {
      const response = await fetch(`${API}${path}`, {
        ...options,
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...options.headers,
        },
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        if (response.status === 401 && token) {
          localStorage.removeItem("taskflow_token");
          localStorage.removeItem("taskflow_user");
          setToken("");
          setUser(null);
          setTasks([]);
          setUsers([]);
        }

        throw new Error(data.message || "Request failed.");
      }

      return data;
    },
    [token]
  );

  // Load tasks
  const loadTasks = useCallback(async () => {
    if (!token || !user) return;

    try {
      const data = await request("/tasks");
      setTasks(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message);
    }
  }, [token, user, request]);

  // Load users for Admin
  const loadUsers = useCallback(async () => {
    if (!token || user?.role !== "Admin") {
      setUsers([]);
      return;
    }

    try {
      const data = await request("/tasks/users");
      setUsers(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message);
    }
  }, [token, user, request]);

  useEffect(() => {
    if (token && user) {
      loadTasks();

      if (user.role === "Admin") {
        loadUsers();
      } else {
        setUsers([]);
      }
    }
  }, [token, user, loadTasks, loadUsers]);

  // Login and registration
  async function handleAuth(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);

    try {
      const endpoint =
        mode === "register" ? "/auth/register" : "/auth/login";

      const body =
        mode === "register"
          ? { name, email, password }
          : { email, password };

      const data = await request(endpoint, {
        method: "POST",
        body: JSON.stringify(body),
      });

      if (mode === "register") {
        setMessage("Registration successful! Please log in.");
        setMode("login");
        setPassword("");
      } else {
        localStorage.setItem("taskflow_token", data.token);
        localStorage.setItem("taskflow_user", JSON.stringify(data.user));

        setToken(data.token);
        setUser(data.user);
        setPassword("");
        setMessage("Login successful!");
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  // Logout
  function logout() {
    localStorage.removeItem("taskflow_token");
    localStorage.removeItem("taskflow_user");

    setToken("");
    setUser(null);
    setTasks([]);
    setUsers([]);
    setPassword("");
    setMessage("You have logged out.");
    setError("");
  }

  // Create a task
  async function createTask(event) {
    event.preventDefault();
    setError("");
    setMessage("");

    try {
      const task = await request("/tasks", {
        method: "POST",
        body: JSON.stringify({
          title: title.trim(),
          category: category.trim() || "General",
          dueDate,
          priority,
          status: "To-Do",
        }),
      });

      setTasks((current) => [task, ...current]);

      setTitle("");
      setCategory("General");
      setDueDate("");
      setPriority("Medium");

      setMessage("Task created successfully!");
    } catch (err) {
      setError(err.message);
    }
  }

  // Update task status
  async function updateStatus(id, status) {
    setError("");
    setMessage("");

    try {
      const updated = await request(`/tasks/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });

      setTasks((current) =>
        current.map((task) => (task._id === id ? updated : task))
      );

      setMessage("Task status updated!");
    } catch (err) {
      setError(err.message);
    }
  }

  // Delete a task
  async function deleteTask(id) {
    if (!window.confirm("Are you sure you want to delete this task?")) {
      return;
    }

    setError("");
    setMessage("");

    try {
      await request(`/tasks/${id}`, { method: "DELETE" });

      setTasks((current) =>
        current.filter((task) => task._id !== id)
      );

      setMessage("Task deleted successfully!");
    } catch (err) {
      setError(err.message);
    }
  }

  // Assign a task to a user (Admin only)
  async function assignTask(taskId, userId) {
    if (!isAdmin || !userId) return;

    setError("");
    setMessage("");

    try {
      await request(`/tasks/${taskId}/assign`, {
        method: "PATCH",
        body: JSON.stringify({ userId }),
      });

      setMessage("Task assigned successfully!");
      await loadTasks();
    } catch (err) {
      setError(err.message);
    }
  }

  // Find a task's assigned user
  function getAssignedUser(task) {
    const assignedId =
      typeof task.userId === "object"
        ? task.userId?._id
        : task.userId;

    return users.find(
      (item) => String(item._id) === String(assignedId)
    );
  }

  // Search and filters
  const visibleTasks = tasks.filter((task) => {
    const matchesSearch = [
      task.title,
      task.category,
      getAssignedUser(task)?.name || "",
      getAssignedUser(task)?.email || "",
    ]
      .join(" ")
      .toLowerCase()
      .includes(search.toLowerCase());

    const matchesStatus =
      statusFilter === "All" || task.status === statusFilter;

    const matchesPriority =
      priorityFilter === "All" || task.priority === priorityFilter;

    return matchesSearch && matchesStatus && matchesPriority;
  });

  const todoCount = tasks.filter(
    (task) => task.status === "To-Do"
  ).length;

  const inProgressCount = tasks.filter(
    (task) => task.status === "In-Progress"
  ).length;

  const completedCount = tasks.filter(
    (task) => task.status === "Completed"
  ).length;

  // Login and registration screen
  if (!token || !user) {
    return (
      <main className="auth-page">
        <form className="auth-card" onSubmit={handleAuth}>
          <h1>TaskFlow</h1>
          <p>Organize your work. One task at a time.</p>

          <div className="auth-tabs">
            <button
              type="button"
              className={mode === "login" ? "active" : ""}
              onClick={() => {
                setMode("login");
                setError("");
                setMessage("");
              }}
            >
              Login
            </button>

            <button
              type="button"
              className={mode === "register" ? "active" : ""}
              onClick={() => {
                setMode("register");
                setError("");
                setMessage("");
              }}
            >
              Register
            </button>
          </div>

          {mode === "register" && (
            <label>
              Full name
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                minLength={2}
                required
                autoComplete="name"
                placeholder="Your name"
              />
            </label>
          )}

          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              placeholder="you@example.com"
            />
          </label>

          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={8}
              maxLength={72}
              required
              autoComplete={
                mode === "login"
                  ? "current-password"
                  : "new-password"
              }
              placeholder="At least 8 characters"
            />
          </label>

          {error && <p className="error">{error}</p>}
          {message && <p className="success">{message}</p>}

          <button className="primary-button" disabled={loading}>
            {loading
              ? "Please wait..."
              : mode === "login"
                ? "Login"
                : "Create account"}
          </button>
        </form>
      </main>
    );
  }

  // Main dashboard
  return (
    <main className="app-page">
      <header className="topbar">
        <div>
          <h1>TaskFlow</h1>
          <p>
            Welcome, {user.name}
            {isAdmin ? " · Admin Dashboard" : " · Member Dashboard"}
          </p>
        </div>

        <div className="user-actions">
          <span className="role-tag">{user.role}</span>
          <button onClick={logout}>Logout</button>
        </div>
      </header>

      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}

      {message && (
        <p className="notice success" role="status">
          {message}
        </p>
      )}

      {/* Statistics */}
      <section className="stats-grid">
        <article className="stat-card">
          <p>Total tasks</p>
          <h2>{tasks.length}</h2>
        </article>

        <article className="stat-card">
          <p>To-Do</p>
          <h2>{todoCount}</h2>
        </article>

        <article className="stat-card">
          <p>In Progress</p>
          <h2>{inProgressCount}</h2>
        </article>

        <article className="stat-card">
          <p>Completed</p>
          <h2>{completedCount}</h2>
        </article>

        {isAdmin && (
          <article className="stat-card">
            <p>Registered users</p>
            <h2>{users.length}</h2>
          </article>
        )}
      </section>

      {/* Create task */}
      <section className="task-form-card">
        <h2>Create a task</h2>

        <form onSubmit={createTask} className="task-form">
          <label>
            Task title
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              minLength={3}
              required
              placeholder="Enter a task"
            />
          </label>

          <label>
            Category
            <input
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="General"
            />
          </label>

          <label>
            Due date
            <input
              type="date"
              value={dueDate}
              min={new Date().toLocaleDateString("en-CA")}
              onChange={(e) => setDueDate(e.target.value)}
              required
            />
          </label>

          <label>
            Priority
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
            >
              <option>Low</option>
              <option>Medium</option>
              <option>High</option>
            </select>
          </label>

          <button className="primary-button">Add task</button>
        </form>
      </section>

      {/* Admin user management */}
      {isAdmin && (
        <section className="task-list-section">
          <div className="list-heading">
            <h2>Registered users</h2>
            <span>{users.length} users</span>
          </div>

          {users.length === 0 ? (
            <p className="empty-state">
              No users found, or the user list could not be loaded.
            </p>
          ) : (
            <div className="users-table-wrapper">
              <table className="users-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Role</th>
                  </tr>
                </thead>

                <tbody>
                  {users.map((item) => (
                    <tr key={item._id}>
                      <td>{item.name}</td>
                      <td>{item.email}</td>
                      <td>
                        <span className="role-tag">
                          {item.role}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* Task list */}
      <section className="task-list-section">
        <div className="list-heading">
          <h2>{isAdmin ? "All tasks" : "My tasks"}</h2>
          <span>
            {visibleTasks.length} of {tasks.length} tasks
          </span>
        </div>

        <div className="task-filters">
          <input
            className="search-input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={
              isAdmin
                ? "Search tasks or assigned users..."
                : "Search tasks by title..."
            }
          />

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            aria-label="Filter by status"
          >
            <option value="All">All statuses</option>
            <option value="To-Do">To-Do</option>
            <option value="In-Progress">In-Progress</option>
            <option value="Completed">Completed</option>
          </select>

          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            aria-label="Filter by priority"
          >
            <option value="All">All priorities</option>
            <option value="Low">Low priority</option>
            <option value="Medium">Medium priority</option>
            <option value="High">High priority</option>
          </select>
        </div>

        {visibleTasks.length === 0 ? (
          <p className="empty-state">
            No tasks found. Create a task above or change your filters.
          </p>
        ) : (
          <div className="task-grid">
            {visibleTasks.map((task) => {
              const assignedUser = getAssignedUser(task);

              const assignedId =
                typeof task.userId === "object"
                  ? task.userId?._id
                  : task.userId;

              return (
                <article className="task-card" key={task._id}>
                  <div className="task-card-heading">
                    <h3>{task.title}</h3>

                    <span
                      className={`priority ${(
                        task.priority || "Medium"
                      ).toLowerCase()}`}
                    >
                      {task.priority}
                    </span>
                  </div>

                  <p>Category: {task.category || "General"}</p>

                  <p>
                    Due:{" "}
                    {task.dueDate
                      ? new Date(task.dueDate).toLocaleDateString()
                      : "Not set"}
                  </p>

                  {isAdmin && (
                    <p>
                      Assigned to:{" "}
                      {assignedUser
                        ? assignedUser.name
                        : String(assignedId || "Unknown user")}
                    </p>
                  )}

                  <label>
                    Status
                    <select
                      value={task.status}
                      onChange={(e) =>
                        updateStatus(task._id, e.target.value)
                      }
                    >
                      <option>To-Do</option>
                      <option>In-Progress</option>
                      <option>Completed</option>
                    </select>
                  </label>

                  {/* Only Admin can reassign tasks */}
                  {isAdmin && (
                    <label>
                      Assign to user
                      <select
                        value={String(assignedId || "")}
                        onChange={(e) =>
                          assignTask(task._id, e.target.value)
                        }
                        required
                      >
                        <option value="" disabled>
                          Select a user
                        </option>

                        {users.map((item) => (
                          <option
                            key={item._id}
                            value={item._id}
                          >
                            {item.name} ({item.role})
                          </option>
                        ))}
                      </select>
                    </label>
                  )}

                  <button
                    className="delete-button"
                    onClick={() => deleteTask(task._id)}
                  >
                    Delete task
                  </button>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}

export default App;
