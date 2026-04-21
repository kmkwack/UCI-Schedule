import { createBrowserRouter } from "react-router";
import Layout from "./components/Layout";
import Home from "./components/Home";
import Timetable from "./components/Timetable";
import Grades from "./components/Grades";
import Community from "./components/Community";
import Friends from "./components/Friends";
import Messages from "./components/Messages";
import Splash from "./components/Splash";
import Auth from "./components/Auth";
import UniversitySelection from "./components/UniversitySelection";
import Login from "./components/Login";
import Signup from "./components/Signup";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Splash,
  },
  {
    path: "/auth",
    Component: Auth,
  },
  {
    path: "/select-university",
    Component: UniversitySelection,
  },
  {
    path: "/login",
    Component: Login,
  },
  {
    path: "/signup",
    Component: Signup,
  },
  {
    path: "/app",
    Component: Layout,
    children: [
      { index: true, Component: Home },
      { path: "timetable", Component: Timetable },
      { path: "grades", Component: Grades },
      { path: "community", Component: Community },
      { path: "friends", Component: Friends },
      { path: "messages", Component: Messages },
    ],
  },
]);