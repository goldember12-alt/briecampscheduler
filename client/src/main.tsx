import React from "react";
import { createRoot } from "react-dom/client";
import { io } from "socket.io-client";
import { App } from "./App";
import "./styles.css";

const socket = io();

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App socket={socket} />
  </React.StrictMode>
);
