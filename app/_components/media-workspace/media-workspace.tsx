"use client"

import { useEffect, useRef, useState } from "react"

import { extractCommonPalette, getRandomHexColor } from "../../_lib/color"
import { drawFilteredImage } from "../../_lib/image-filters"
import type { ActiveFilter, EditorImage } from "../../_types/editor"
import { ImageCanvas } from "./image-canvas"
import { WorkspaceSidebar } from "./workspace-sidebar"

export function MediaWorkspace() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [image, setImage] = useState<EditorImage | null>(null)
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>("none")
  const [pixelSize, setPixelSize] = useState(12)
  const [noiseAmount, setNoiseAmount] = useState(24)
  const [bloomThreshold, setBloomThreshold] = useState(190)
  const [bloomStrength, setBloomStrength] = useState(70)
  const [bloomRadius, setBloomRadius] = useState(18)
  const [modulationDirection, setModulationDirection] = useState<
    "horizontal" | "vertical"
  >("horizontal")
  const [modulationLineCount, setModulationLineCount] = useState(90)
  const [modulationAmplitude, setModulationAmplitude] = useState(34)
  const [modulationThickness, setModulationThickness] = useState(1)
  const [scanLineSpacing, setScanLineSpacing] = useState(8)
  const [scanLineThickness, setScanLineThickness] = useState(1)
  const [scanLineOpacity, setScanLineOpacity] = useState(35)
  const [paletteColors, setPaletteColors] = useState<string[]>([
    "#000000",
    "#ffffff",
    "#808080",
  ])
  const [smartColoring, setSmartColoring] = useState(false)

  useEffect(() => {
    return () => {
      if (image) {
        URL.revokeObjectURL(image.url)
      }
    }
  }, [image])

  useEffect(() => {
    const canvas = canvasRef.current

    if (!canvas || !image) {
      return
    }

    let cancelled = false
    const sourceImage = new window.Image()

    sourceImage.onload = () => {
      if (cancelled) {
        return
      }

      drawFilteredImage(canvas, sourceImage, {
        activeFilter,
        bloomRadius,
        bloomStrength,
        bloomThreshold,
        modulationAmplitude,
        modulationDirection,
        modulationLineCount,
        modulationThickness,
        noiseAmount,
        paletteColors,
        pixelSize,
        scanLineOpacity,
        scanLineSpacing,
        scanLineThickness,
        smartColoring,
      })
    }

    sourceImage.src = image.url

    return () => {
      cancelled = true
    }
  }, [
    activeFilter,
    bloomRadius,
    bloomStrength,
    bloomThreshold,
    image,
    modulationAmplitude,
    modulationDirection,
    modulationLineCount,
    modulationThickness,
    noiseAmount,
    paletteColors,
    pixelSize,
    scanLineOpacity,
    scanLineSpacing,
    scanLineThickness,
    smartColoring,
  ])

  useEffect(() => {
    if (!image) {
      return
    }

    let cancelled = false
    const sourceImage = new window.Image()

    sourceImage.onload = () => {
      if (!cancelled) {
        setPaletteColors(extractCommonPalette(sourceImage, 3))
      }
    }

    sourceImage.src = image.url

    return () => {
      cancelled = true
    }
  }, [image])

  const openFilePicker = () => {
    fileInputRef.current?.click()
  }

  const selectFile = (file?: File) => {
    if (!file || !file.type.startsWith("image/")) {
      return
    }

    const nextImage = {
      name: file.name,
      url: URL.createObjectURL(file),
    }

    // Release the previous preview before replacing it with the new image.
    setImage((currentImage) => {
      if (currentImage) {
        URL.revokeObjectURL(currentImage.url)
      }

      return nextImage
    })

    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const clearImage = () => {
    setImage((currentImage) => {
      if (currentImage) {
        URL.revokeObjectURL(currentImage.url)
      }

      return null
    })

    setActiveFilter("none")
  }

  const addPaletteColor = () => {
    setPaletteColors((currentColors) => [...currentColors, "#ffffff"])
  }

  const updatePaletteColor = (colorIndex: number, nextColor: string) => {
    setPaletteColors((currentColors) =>
      currentColors.map((color, index) =>
        index === colorIndex ? nextColor : color,
      ),
    )
  }

  const deletePaletteColor = (colorIndex: number) => {
    setPaletteColors((currentColors) =>
      currentColors.filter((_, index) => index !== colorIndex),
    )
  }

  const randomizePaletteColors = () => {
    setPaletteColors((currentColors) =>
      currentColors.map(() => getRandomHexColor()),
    )
  }

  return (
    <main className="flex min-h-screen flex-col bg-black text-sm text-zinc-300 md:flex-row">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={(event) => selectFile(event.target.files?.[0])}
      />

      <WorkspaceSidebar
        activeFilter={activeFilter}
        bloomRadius={bloomRadius}
        bloomStrength={bloomStrength}
        bloomThreshold={bloomThreshold}
        hasImage={Boolean(image)}
        modulationAmplitude={modulationAmplitude}
        modulationDirection={modulationDirection}
        modulationLineCount={modulationLineCount}
        modulationThickness={modulationThickness}
        noiseAmount={noiseAmount}
        onActiveFilterChange={setActiveFilter}
        onAddImage={openFilePicker}
        onAddPaletteColor={addPaletteColor}
        onBloomRadiusChange={setBloomRadius}
        onBloomStrengthChange={setBloomStrength}
        onBloomThresholdChange={setBloomThreshold}
        onDeletePaletteColor={deletePaletteColor}
        onModulationAmplitudeChange={setModulationAmplitude}
        onModulationDirectionChange={setModulationDirection}
        onModulationLineCountChange={setModulationLineCount}
        onModulationThicknessChange={setModulationThickness}
        onNoiseAmountChange={setNoiseAmount}
        onPaletteColorChange={updatePaletteColor}
        onPixelSizeChange={setPixelSize}
        onRandomizePaletteColors={randomizePaletteColors}
        onRemoveImage={clearImage}
        onScanLineOpacityChange={setScanLineOpacity}
        onScanLineSpacingChange={setScanLineSpacing}
        onScanLineThicknessChange={setScanLineThickness}
        onSmartColoringChange={setSmartColoring}
        paletteColors={paletteColors}
        pixelSize={pixelSize}
        scanLineOpacity={scanLineOpacity}
        scanLineSpacing={scanLineSpacing}
        scanLineThickness={scanLineThickness}
        smartColoring={smartColoring}
      />

      <div className="flex min-w-0 flex-1">
        <ImageCanvas
          activeFilter={activeFilter}
          bloomStrength={bloomStrength}
          canvasRef={canvasRef}
          image={image}
          isDragging={isDragging}
          modulationLineCount={modulationLineCount}
          noiseAmount={noiseAmount}
          onClearImage={clearImage}
          onDragActiveChange={setIsDragging}
          onImageSelected={selectFile}
          paletteColorCount={paletteColors.length}
          pixelSize={pixelSize}
          scanLineSpacing={scanLineSpacing}
        />
      </div>
    </main>
  )
}
