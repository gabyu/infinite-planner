"use client"

import type React from "react"

import { useState } from "react"
import { Smartphone, Tablet, Monitor } from "lucide-react"

interface VideoConfig {
  id: string
  device: string
  dataSource: string
  videoUrl: string
  description: string
  icon: React.ComponentType<{ className?: string }>
}

const VIDEO_CONFIGS: VideoConfig[] = [
  {
    id: "ipad-flightradar",
    device: "iPadOS",
    dataSource: "FlightRadar24",
    videoUrl: "https://www.youtube.com/embed/Gk6QbA9K-Uw",
    description: "Complete guide for iPad users with FlightRadar24 data",
    icon: Tablet,
  },
  {
    id: "android-flightradar",
    device: "Android",
    dataSource: "FlightRadar24",
    videoUrl: "https://www.youtube.com/embed/wfDFqH65rCc",
    description: "Step-by-step tutorial for Android users with FlightRadar24 data",
    icon: Smartphone,
  },
  {
    id: "desktop-flightaware",
    device: "Desktop",
    dataSource: "FlightAware",
    videoUrl: "https://www.youtube.com/embed/1PxZdh3p6Xg",
    description: "Complete tutorial for Desktop/Mac users with FlightAware data",
    icon: Monitor,
  },
]

export function VideoSelector() {
  const [selectedConfig, setSelectedConfig] = useState<string>("desktop-flightaware")
  const currentConfig = VIDEO_CONFIGS.find((c) => c.id === selectedConfig)!

  return (
    <div className="space-y-8">
      {/* Configuration Selection */}
      <div>
        <h3 className="text-2xl font-semibold mb-4">Select Your Setup</h3>
        <p className="text-gray-600 dark:text-gray-300 mb-6">
          Choose your device and data source to watch the appropriate tutorial
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {VIDEO_CONFIGS.map((config) => {
            const Icon = config.icon
            const isSelected = selectedConfig === config.id

            return (
              <button
                key={config.id}
                onClick={() => setSelectedConfig(config.id)}
                className={`p-4 rounded-lg border-2 transition-all cursor-pointer text-left ${
                  isSelected
                    ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                    : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                }`}
              >
                <div className="flex items-start gap-3">
                  <Icon
                    className={`w-6 h-6 mt-1 flex-shrink-0 ${
                      isSelected ? "text-blue-600 dark:text-blue-400" : "text-gray-400 dark:text-gray-500"
                    }`}
                  />
                  <div>
                    <div className="font-semibold text-gray-900 dark:text-white">{config.device}</div>
                    <div className="text-sm text-gray-600 dark:text-gray-300">with {config.dataSource}</div>
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Video Display */}
      <div>
        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-6 mb-4">
          <h3 className="text-lg font-semibold mb-2 text-gray-900 dark:text-white">
            {currentConfig.device} with {currentConfig.dataSource}
          </h3>
          <p className="text-gray-600 dark:text-gray-300">{currentConfig.description}</p>
        </div>

        <div className="relative w-full mb-8" style={{ paddingBottom: "56.25%" }}>
          <iframe
            key={currentConfig.id}
            className="absolute top-0 left-0 w-full h-full rounded-lg"
            src={currentConfig.videoUrl}
            title={`Tutorial: ${currentConfig.device} with ${currentConfig.dataSource}`}
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      </div>
    </div>
  )
}
