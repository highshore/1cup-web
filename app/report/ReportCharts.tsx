"use client";

// Isolated chart bundle: chart.js + react-chartjs-2 live here so they are
// code-split into their own chunk and only fetched when a chart renders,
// instead of bloating the report route's initial bundle.
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title as ChartTitle,
  Tooltip,
  Legend,
  ArcElement,
} from "chart.js";
import { Line, Bar, Doughnut } from "react-chartjs-2";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ChartTitle,
  Tooltip,
  Legend,
  ArcElement
);

export { Line, Bar, Doughnut };
