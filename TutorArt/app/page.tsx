"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Calendar, Clock, User, GraduationCap, Settings } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabaseClient"

// Define los tipos correctos
interface Horario {
  id: number;
  dia_semana: string;
  hora_inicio: string;
  hora_fin: string;
  estado: string;
}

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

interface ReservationForm {
  studentName: string;
  program: string;
  email?: string;
  telefono?: string;
}

export default function StudentView() {
  const [horarios, setHorarios] = useState<Horario[]>([])
  const [reservas, setReservas] = useState<Reserva[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedWeek, setSelectedWeek] = useState(new Date())
  const [selectedSlot, setSelectedSlot] = useState<Horario | null>(null)
  const [reservation, setReservation] = useState<ReservationForm>({ studentName: "", program: "", email: "", telefono: "" })
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [authDialogOpen, setAuthDialogOpen] = useState(false)
  const [adminKey, setAdminKey] = useState("")
  const [authError, setAuthError] = useState("")
  const router = useRouter()

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
      if (horariosData) setHorarios(horariosData as Horario[])
      if (reservasData) setReservas(reservasData as Reserva[])
      setLoading(false)
    }
    fetchHorariosYReservas()
  }, [])

  // Cambiar la lista de días a minúsculas
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

  const handleSlotClick = (slot: Horario) => {
    if (slot.estado === "disponible") {
      setSelectedSlot(slot)
      setIsDialogOpen(true)
    }
  }

  const handleReservation = async () => {
    if (selectedSlot && reservation.studentName && reservation.program) {
      // Insertar la reserva en Supabase
      const { error: reservaError } = await supabase.from("reservas").insert({
        estudiante_nombre: reservation.studentName,
        estudiante_carrera: reservation.program,
        email: reservation.email || "",
        telefono: reservation.telefono || "",
        fecha: new Date().toISOString().slice(0, 10),
        horario_id: selectedSlot.id,
        estado: "pendiente"
      })
      // Actualizar el estado del horario a 'reservado'
      const { error: horarioError } = await supabase.from("horarios").update({ estado: "reservado" }).eq("id", selectedSlot.id)
      if (!reservaError && !horarioError) {
        // Refrescar horarios
        const { data } = await supabase.from("horarios").select("*").order("dia_semana").order("hora_inicio")
        setHorarios(data as Horario[])
        setReservation({ studentName: "", program: "", email: "", telefono: "" })
      setIsDialogOpen(false)
      setSelectedSlot(null)
      } else {
        alert("Error al reservar. Intenta de nuevo.")
      }
    }
  }

  const getSlotButtonClass = (slot: Horario | undefined) => {
    if (!slot) return "bg-gray-600 hover:bg-gray-700 text-gray-400 cursor-not-allowed"
    if (slot.estado === "reservado") return "bg-red-600 hover:bg-red-700 text-white cursor-not-allowed"
    if (slot.estado === "disponible") return "bg-green-600 hover:bg-green-700 text-white cursor-pointer"
    return "bg-gray-600 hover:bg-gray-700 text-gray-400 cursor-not-allowed"
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

  return (
    <div className="min-h-screen bg-black text-white p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2">TutorArt - Agendamiento Tutorías - Dr. Arturo Rodríguez, PhD.</h1>
          </div>
          <Button
            variant="outline"
            className="bg-gray-800 border-gray-600 text-white hover:bg-gray-700"
            onClick={() => setAuthDialogOpen(true)}
          >
              <Settings className="w-4 h-4 mr-2" />
              Administrador
            </Button>
        </div>

        {/* Week Navigation */}
        <Card className="bg-gray-900 border-gray-700 mb-6">
          <CardHeader>
            <CardTitle className="text-white flex items-center">
              <Calendar className="w-5 h-5 mr-2" />
              Semana del {getWeekDates()[0]} al {getWeekDates()[5]}
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

        {/* Schedule Grid */}
        <Card className="bg-gray-900 border-gray-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center">
              <Clock className="w-5 h-5 mr-2" />
              Horarios Disponibles
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-7 gap-2">
              {/* Header */}
              <div className="font-semibold text-center p-2 text-white">Hora</div>
              {days.map((day, index) => (
                <div key={day} className="font-semibold text-center p-2 text-white">
                  {day.charAt(0).toUpperCase() + day.slice(1)}
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
                      <Button
                        key={`${day}-${time}`}
                        onClick={() => slot && slot.estado === "disponible" && handleSlotClick(slot)}
                        className={`h-12 text-xs ${getSlotButtonClass(slot)}`}
                        disabled={!slot || slot.estado !== "disponible"}
                      >
                        {slot?.estado === "reservado" ? (
                          <div className="text-center">
                            <div>Reservado</div>
                            {/* Mostrar inicial y programa */}
                            {(() => {
                              const reserva = reservas.find(r => r.horario_id === slot.id)
                              if (!reserva) return null
                              const inicial = reserva.estudiante_nombre ? reserva.estudiante_nombre.charAt(0).toUpperCase() : "?"
                              return (
                                <div className="text-xs opacity-75">{inicial} - {reserva.estudiante_carrera}</div>
                              )
                            })()}
                          </div>
                        ) : slot?.estado === "disponible" ? (
                          "Disponible"
                        ) : (
                          "No disponible"
                        )}
                      </Button>
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
            <div className="w-4 h-4 bg-green-600 rounded"></div>
            <span className="text-sm">Disponible</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-red-600 rounded"></div>
            <span className="text-sm">Reservado</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-gray-600 rounded"></div>
            <span className="text-sm">No disponible</span>
          </div>
        </div>

        {/* Reservation Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="bg-gray-900 border-gray-700 text-white">
            <DialogHeader>
              <DialogTitle className="flex items-center">
                <User className="w-5 h-5 mr-2" />
                Reservar Tutoría
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-300 mb-2">
                  {selectedSlot?.dia_semana} - {selectedSlot?.hora_inicio}
                </p>
              </div>
              <div>
                <Label htmlFor="studentName" className="text-white">
                  Nombre del Estudiante
                </Label>
                <Input
                  id="studentName"
                  value={reservation.studentName}
                  onChange={(e) => setReservation((prev) => ({ ...prev, studentName: e.target.value }))}
                  className="bg-gray-800 border-gray-600 text-white"
                  placeholder="Ingresa tu nombre completo"
                />
              </div>
              <div>
                <Label htmlFor="program" className="text-white">
                  Carrera/Programa
                </Label>
                <Input
                  id="program"
                  value={reservation.program}
                  onChange={(e) => setReservation((prev) => ({ ...prev, program: e.target.value }))}
                  className="bg-gray-800 border-gray-600 text-white"
                  placeholder="Ej: Ingeniería de Sistemas"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={handleReservation}
                  disabled={!reservation.studentName || !reservation.program}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  <GraduationCap className="w-4 h-4 mr-2" />
                  Confirmar Reserva
                </Button>
                <Button
                  onClick={() => setIsDialogOpen(false)}
                  variant="outline"
                  className="bg-gray-800 border-gray-600 text-white hover:bg-gray-700"
                >
                  Cancelar
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Diálogo de autenticación para administrador */}
        <Dialog open={authDialogOpen} onOpenChange={setAuthDialogOpen}>
          <DialogContent className="bg-gray-900 border-gray-700 text-white max-w-sm mx-auto">
            <DialogHeader>
              <DialogTitle>Clave de Administrador</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <Input
                type="password"
                placeholder="Ingresa la clave"
                value={adminKey}
                onChange={e => setAdminKey(e.target.value)}
                className="bg-gray-800 border-gray-600 text-white"
                autoFocus
              />
              {authError && <div className="text-red-400 text-sm">{authError}</div>}
              <div className="flex gap-2 justify-end">
                <Button
                  onClick={() => {
                    if (adminKey === "R2D2#") {
                      setAuthDialogOpen(false)
                      setAuthError("")
                      setAdminKey("")
                      router.push("/admin")
                    } else {
                      setAuthError("Clave incorrecta")
                    }
                  }}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  Ingresar
                </Button>
                <Button
                  variant="outline"
                  className="bg-gray-800 border-gray-600 text-white hover:bg-gray-700"
                  onClick={() => {
                    setAuthDialogOpen(false)
                    setAuthError("")
                    setAdminKey("")
                  }}
                >
                  Cancelar
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
