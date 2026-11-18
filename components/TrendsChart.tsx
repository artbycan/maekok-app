// components/TrendsChart.tsx
'use client'

import { Skeleton } from '@/components/ui/skeleton';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  ChartOptions
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { Chart } from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);
Chart.register(ChartDataLabels);

export interface TrendData {
  date: string;
  "จำนวนผู้ป่วย": number;
}

export interface MultiSeriesTrendData {
  labels: string[];
  series: {
    key: string;
    label: string;
    data: number[];
    total?: number;
  }[];
}

interface TrendsChartProps {
  data?: TrendData[];
  multiSeries?: MultiSeriesTrendData | null;
  loading: boolean;
}

const SERIES_COLORS = [
  '#0369a1',
  '#dc2626',
  '#059669',
  '#d97706',
  '#7c3aed',
  '#db2777',
  '#0891b2',
  '#4f46e5',
  '#65a30d',
  '#ea580c',
];

const TrendsChart: React.FC<TrendsChartProps> = ({ data = [], multiSeries, loading }) => {
  const isMulti = Boolean(multiSeries);

  const chartData = isMulti && multiSeries
    ? {
        labels: multiSeries.labels,
        datasets: multiSeries.series.map((s, idx) => {
          const color = SERIES_COLORS[idx % SERIES_COLORS.length];
          return {
            label: s.label,
            data: s.data,
            borderColor: color,
            backgroundColor: `${color}1a`,
            borderWidth: 2,
            pointBackgroundColor: color,
            pointBorderColor: '#ffffff',
            pointBorderWidth: 1,
            pointRadius: 2,
            pointHoverRadius: 5,
            tension: 0.3,
            fill: false,
          };
        }),
      }
    : {
        labels: data.map(item => item.date),
        datasets: [
          {
            label: 'จำนวนผู้ป่วย',
            data: data.map(item => item["จำนวนผู้ป่วย"]),
            borderColor: '#0369a1',
            backgroundColor: 'rgba(3, 105, 161, 0.1)',
            borderWidth: 3,
            pointBackgroundColor: '#0369a1',
            pointBorderColor: '#ffffff',
            pointBorderWidth: 2,
            pointRadius: 3,
            pointHoverRadius: 6,
            tension: 0.4,
            fill: true,
          },
        ],
      };

  const options: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        labels: {
          usePointStyle: true,
          padding: 14,
          color: '#0c4a6e',
          font: { size: 12 },
        },
      },
      tooltip: {
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        titleColor: '#0c4a6e',
        bodyColor: '#0c4a6e',
        borderColor: '#38bdf8',
        borderWidth: 1,
        cornerRadius: 8,
        displayColors: true,
        padding: 12,
      },
      datalabels: {
        display: false,
      },
    },
    scales: {
      x: {
        ticks: {
          color: '#0c4a6e',
          font: { size: 11 },
          maxRotation: 45,
          minRotation: 0,
          autoSkip: true,
          maxTicksLimit: 18,
        },
        grid: {
          color: '#e0f2fe',
        },
        border: {
          display: false,
        },
      },
      y: {
        beginAtZero: true,
        ticks: {
          color: '#0c4a6e',
          font: { size: 12 },
        },
        grid: {
          color: '#e0f2fe',
        },
        border: {
          display: false,
        },
      },
    },
    interaction: {
      intersect: false,
      mode: 'index',
    },
  };

  if (loading) {
    return <Skeleton className="h-full w-full" />;
  }

  const hasData = isMulti
    ? Boolean(multiSeries && multiSeries.labels.length > 0 && multiSeries.series.length > 0)
    : data.length > 0;

  if (!hasData) {
    return (
      <div className="flex items-center justify-center h-full text-blue-600">
        <div className="text-center">
          <div className="text-lg font-medium">ไม่มีข้อมูลสำหรับแสดงกราฟ</div>
          <div className="text-sm mt-2">ลองเปลี่ยนเงื่อนไขการค้นหา</div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full">
      <Line data={chartData} options={options} />
    </div>
  );
};

export default TrendsChart;
