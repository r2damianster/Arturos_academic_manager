"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Calendar, Clock, Save, ArrowLeft, Users, Settings } from "lucide-react"
import Link from "next/link"
import { supabase } from "@/lib/supabaseClient"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"

// Define el tipo correcto para los horarios
interface Horario {
  id: number;
  dia_semana: string;
  hora_inicio: string;
  hora_fin: string;
  estado: string;
}

// Agregar tipo para reserva
interface Reserva {
  id: number;
  estudiante_nombre: string;
  estudiante_carrera: string;
  email: string;
  telefono: string;
  fecha: string;
  horario_id: number;
  estado: string;
}

export default function AdminView() {
  const [horarios, setHorarios] = useState<Horario[]>([])
  const [reservas, setReservas] = useState<Reserva[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedWeek, setSelectedWeek] = useState(new Date())
  const [hasChanges, setHasChanges] = useState(false)
  const [selectedReserva, setSelectedReserva] = useState<Reserva | null>(null)
  const [selectedHorario, setSelectedHorario] = useState<Horario | null>(null)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)

  useEffect(() => {
    async function fetchHorariosYReservas() {
      setLoading(true)
      const { data: horariosData } = await supabase
        .from("horarios")
        .select("*")
        .order("dia_semana")
        .order("hora_inicio")
      const { data: reservasData } = await supabase
        .from("reservas")
        .select("*")
        .eq("estado", "pendiente")
      if (horariosData) setHorarios(horariosData)
      if (reservasData) setReservas(reservasData)
      setLoading(false)
    }
    fetchHorariosYReservas()
  }, [])

  const days = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado"]
  const timeSlotsList = [
    "07:00",
    "07:30",
    "08:00",
    "08:30",
    "09:00",
    "09:30",
    "10:00",
    "10:30",
    "11:00",
    "11:30",
    "12:00",
    "12:30",
    "13:00",
    "13:30",
    "14:00",
    "14:30",
    "15:00",
    "15:30",
    "16:00",
    "16:30",
    "17:00",
    "17:30",
    "18:00",
    "18:30",
    "19:00",
    "19:30",
    "20:00",
  ]

  // Actualizar estado de un horario en Supabase
  const toggleSlotAvailability = async (slotId: number, currentState: string) => {
    const nuevoEstado = currentState === "disponible" ? "no_disponible" : "disponible"
    const { error } = await supabase
      .from("horarios")
      .update({ estado: nuevoEstado })
      .eq("id", slotId)
    if (!error) {
      setHorarios((prev: Horario[]) =>
        prev.map((slot) =>
          slot.id === slotId ? { ...slot, estado: nuevoEstado } : slot
        )
      )
      setHasChanges(true)
    }
  }

  const saveChanges = () => {
    // Aquí se guardarían los cambios en la base de datos
    setHasChanges(false)
    alert("Cambios guardados exitosamente")
  }

  const getWeekDates = () => {
    const startOfWeek = new Date(selectedWeek)
    const day = startOfWeek.getDay()
    const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1)
    startOfWeek.setDate(diff)

    return days.map((_, index) => {
      const date = new Date(startOfWeek)
      date.setDate(startOfWeek.getDate() + index)
      return date.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit" })
    })
  }

  const getSlotStats = () => {
    const total = horarios.length
    const available = horarios.filter((slot) => slot.estado === "disponible").length
    const reserved = horarios.filter((slot) => slot.estado === "reservado").length
    const unavailable = horarios.filter((slot) => slot.estado === "no_disponible").length

    return { total, available, reserved, unavailable }
  }

  const stats = getSlotStats()

  // Agregar función para poner todos los horarios en no_disponible
  const setAllNoDisponibles = async () => {
    if (!window.confirm("¿Estás seguro de poner todos los horarios como no disponibles?")) return;
    const { error } = await supabase
      .from("horarios")
      .update({ estado: "no_disponible" })
      .neq("estado", "no_disponible")
    if (!error) {
      setHorarios((prev: Horario[]) => prev.map((h) => ({ ...h, estado: "no_disponible" })))
      setHasChanges(true)
    }
  }

  // Función para eliminar reserva y actualizar estado del horario
  const eliminarReservaYActualizarHorario = async (horarioId: number, nuevoEstado: "disponible" | "no_disponible") => {
    // Eliminar reserva
    await supabase.from("reservas").delete().eq("horario_id", horarioId)
    // Actualizar estado del horario
    await supabase.from("horarios").update({ estado: nuevoEstado }).eq("id", horarioId)
    // Refrescar horarios y reservas
    const { data: horariosData } = await supabase
      .from("horarios")
      .select("*")
      .order("dia_semana")
      .order("hora_inicio")
    const { data: reservasData } = await supabase
      .from("reservas")
      .select("*")
      .eq("estado", "pendiente")
    if (horariosData) setHorarios(horariosData)
    if (reservasData) setReservas(reservasData)
    setIsDeleteDialogOpen(false)
    setSelectedReserva(null)
    setSelectedHorario(null)
  }

  return (
    <div className="min-h-screen bg-black text-white p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2">Panel de Administración</h1>
            <p className="text-gray-300">Dr. Arturo Rodríguez, PhD.</p>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={setAllNoDisponibles}
              className="bg-gray-700 hover:bg-gray-800 text-white"
            >
              Poner todos NO disponibles
            </Button>
            {hasChanges && (
              <Button onClick={saveChanges} className="bg-green-600 hover:bg-green-700 text-white">
                <Save className="w-4 h-4 mr-2" />
                Guardar Cambios
              </Button>
            )}
            <Link href="/">
              <Button variant="outline" className="bg-gray-800 border-gray-600 text-white hover:bg-gray-700">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Vista Estudiante
              </Button>
            </Link>
          </div>
        </div>

        {/* Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card className="bg-gray-900 border-gray-700">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400">Total Horarios</p>
                  <p className="text-2xl font-bold text-white">{stats.total}</p>
                </div>
                <Settings className="w-8 h-8 text-gray-400" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gray-900 border-gray-700">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400">Disponibles</p>
                  <p className="text-2xl font-bold text-green-400">{stats.available}</p>
                </div>
                <Clock className="w-8 h-8 text-green-400" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gray-900 border-gray-700">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400">Reservados</p>
                  <p className="text-2xl font-bold text-red-400">{stats.reserved}</p>
                </div>
                <Users className="w-8 h-8 text-red-400" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gray-900 border-gray-700">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400">No Disponibles</p>
                  <p className="text-2xl font-bold text-gray-400">{stats.unavailable}</p>
                </div>
                <Calendar className="w-8 h-8 text-gray-400" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Week Navigation */}
        <Card className="bg-gray-900 border-gray-700 mb-6">
          <CardHeader>
            <CardTitle className="text-white flex items-center">
              <Calendar className="w-5 h-5 mr-2" />
              Configurar Semana del {getWeekDates()[0]} al {getWeekDates()[5]}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* Eliminar este bloque: */}
            {/*
            <div className="flex gap-2">
              <Button
                onClick={() => {
                  const newWeek = new Date(selectedWeek)
                  newWeek.setDate(newWeek.getDate() - 7)
                  setSelectedWeek(newWeek)
                }}
                variant="outline"
                className="bg-gray-800 border-gray-600 text-white hover:bg-gray-700"
              >
                Semana Anterior
              </Button>
              <Button
                onClick={() => {
                  const newWeek = new Date(selectedWeek)
                  newWeek.setDate(newWeek.getDate() + 7)
                  setSelectedWeek(newWeek)
                }}
                variant="outline"
                className="bg-gray-800 border-gray-600 text-white hover:bg-gray-700"
              >
                Semana Siguiente
              </Button>
            </div>
            */}
          </CardContent>
        </Card>

        {/* Schedule Configuration Grid */}
        <Card className="bg-gray-900 border-gray-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center">
              <Settings className="w-5 h-5 mr-2" />
              Configuración de Horarios
            </CardTitle>
            <p className="text-gray-400 text-sm">
              Activa o desactiva los horarios disponibles para esta semana. Los horarios reservados no se pueden
              modificar.
            </p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-7 gap-2">
              {/* Header */}
              <div className="font-semibold text-center p-2 text-white">Hora</div>
              {days.map((day, index) => (
                <div key={day} className="font-semibold text-center p-2 text-white">
                  {day}
                  <br />
                  <span className="text-sm text-gray-400">{getWeekDates()[index]}</span>
                </div>
              ))}

              {/* Time slots */}
              {timeSlotsList.map((time) => (
                <div key={time} className="contents">
                  <div className="text-center p-2 text-sm font-medium text-white">{time}</div>
                  {days.map((day) => {
                    const slot = horarios.find((h) => h.dia_semana === day && h.hora_inicio.slice(0,5) === time)
                    return (
                      <div key={`${day}-${time}`} className="p-2">
                        {slot?.estado === "reservado" ? (
                          <div
                            className="bg-red-600 p-2 rounded text-center text-xs cursor-pointer"
                            onClick={() => {
                              const reserva = reservas.find(r => r.horario_id === slot.id)
                              setSelectedReserva(reserva || null)
                              setSelectedHorario(slot)
                              setIsDeleteDialogOpen(true)
                            }}
                          >
                            <div className="font-semibold">Reservado</div>
                            {/* Mostrar datos de la reserva como antes */}
                            {(() => {
                              const reserva = reservas.find(r => r.horario_id === slot.id)
                              if (!reserva) return (<div className="text-xs opacity-75">Sin datos</div>);
                              return (
                                <>
                                  <div className="text-xs opacity-75">{reserva.estudiante_nombre}</div>
                                  <div className="text-xs opacity-75">{reserva.estudiante_carrera}</div>
                                  <div className="text-xs opacity-75">{reserva.email}</div>
                                  <div className="text-xs opacity-75">{reserva.telefono}</div>
                                </>
                              );
                            })()}
                          </div>
                        ) : (
                          <div className="flex items-center justify-center">
                            <Switch
                              checked={slot?.estado === "disponible"}
                              onCheckedChange={() => slot && toggleSlotAvailability(slot.id, slot.estado)}
                              className="data-[state=checked]:bg-green-600"
                            />
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Legend */}
        <div className="mt-6 flex gap-4 justify-center">
          <div className="flex items-center gap-2">
            <Switch checked={true} className="data-[state=checked]:bg-green-600" />
            <span className="text-sm">Disponible</span>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={false} />
            <span className="text-sm">No disponible</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-red-600 rounded"></div>
            <span className="text-sm">Reservado (no modificable)</span>
          </div>
        </div>

        {hasChanges && (
          <div className="mt-6 p-4 bg-yellow-900 border border-yellow-600 rounded-lg">
            <p className="text-yellow-200 text-center">
              Tienes cambios sin guardar. No olvides hacer clic en "Guardar Cambios" para aplicar la nueva
              configuración.
            </p>
          </div>
        )}
      </div>

      {/* Modal para eliminar reserva y elegir estado */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="bg-gray-900 border-gray-700 text-white max-w-sm mx-auto">
          <DialogHeader>
            <DialogTitle>Eliminar Reserva</DialogTitle>
          </DialogHeader>
          {selectedReserva && (
            <div className="space-y-2">
              <div><b>Nombre:</b> {selectedReserva.estudiante_nombre}</div>
              <div><b>Carrera:</b> {selectedReserva.estudiante_carrera}</div>
              <div><b>Email:</b> {selectedReserva.email}</div>
              <div><b>Teléfono:</b> {selectedReserva.telefono}</div>
            </div>
          )}
          <div className="flex flex-col gap-2 mt-4">
            <Button
              onClick={() => selectedHorario && eliminarReservaYActualizarHorario(selectedHorario.id, "disponible")}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              Eliminar y dejar disponible
            </Button>
            <Button
              onClick={() => selectedHorario && eliminarReservaYActualizarHorario(selectedHorario.id, "no_disponible")}
              className="bg-gray-700 hover:bg-gray-800 text-white"
            >
              Eliminar y dejar no disponible
            </Button>
            <Button
              variant="outline"
              className="bg-gray-800 border-gray-600 text-white hover:bg-gray-700"
              onClick={() => setIsDeleteDialogOpen(false)}
            >
              Cancelar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
