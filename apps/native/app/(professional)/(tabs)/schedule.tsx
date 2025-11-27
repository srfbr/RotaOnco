import { Container } from "@/components/container";
import {
    AppointmentListItem,
    AppointmentStatus,
    AppointmentType,
    PatientStatus,
    PatientSummary,
    createAppointment,
    fetchProfessionalAppointments,
    searchPatients,
    updateAppointment,
    updateAppointmentStatus,
} from "@/lib/api";
import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import {
    ActivityIndicator,
    Modal,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { useCallback, useMemo, useState } from "react";

type CalendarDay = {
    date: string;
    label: string;
    isCurrentMonth: boolean;
};

type CalendarRow = {
    id: string;
    days: CalendarDay[];
};

const TYPE_OPTIONS: Array<{ value: AppointmentType; label: string }> = [
    { value: "triage", label: "Triagem" },
    { value: "treatment", label: "Tratamento" },
    { value: "return", label: "Retorno" },
];

const APPOINTMENT_STATUS_LABELS: Record<AppointmentStatus, string> = {
    scheduled: "Agendada",
    confirmed: "Confirmada",
    completed: "Concluída",
    no_show: "Faltou",
    canceled: "Cancelada",
};

const APPOINTMENT_STATUS_BADGE_STYLES: Record<AppointmentStatus, { bg: string; text: string }> = {
    scheduled: { bg: "#E0F2FE", text: "#0369A1" },
    confirmed: { bg: "#DCFCE7", text: "#166534" },
    completed: { bg: "#F5F3FF", text: "#4C1D95" },
    no_show: { bg: "#FEE2E2", text: "#B91C1C" },
    canceled: { bg: "#E2E8F0", text: "#1F2937" },
};

const TYPE_ACCENTS: Record<AppointmentType, string> = {
    triage: "#2563EB",
    treatment: "#0EA5E9",
    return: "#7C3AED",
};

const PATIENT_STATUS_LABELS: Record<PatientStatus, string> = {
    active: "Ativo",
    inactive: "Inativo",
    at_risk: "Em risco",
};

const WEEKDAY_LABELS = ["D", "S", "T", "Q", "Q", "S", "S"];

function formatDateKey(date: Date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function parseDateKey(key: string) {
    const [year, month, day] = key.split("-").map((value) => Number.parseInt(value, 10));
    return new Date(year, month - 1, day);
}

function startOfMonth(date: Date) {
    return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date: Date, amount: number) {
    return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

function buildCalendarGrid(month: Date): CalendarRow[] {
    const firstDayOfMonth = startOfMonth(month);
    const startWeekday = firstDayOfMonth.getDay();
    const gridStart = new Date(firstDayOfMonth);
    gridStart.setDate(firstDayOfMonth.getDate() - startWeekday);

    const weeks: CalendarRow[] = [];
    const cursor = new Date(gridStart);

    for (let weekIndex = 0; weekIndex < 6; weekIndex += 1) {
        const days: CalendarDay[] = [];

        for (let dayIndex = 0; dayIndex < 7; dayIndex += 1) {
            const current = new Date(cursor);
            const dateKey = formatDateKey(current);
            days.push({
                date: dateKey,
                label: String(current.getDate()),
                isCurrentMonth:
                    current.getMonth() === month.getMonth() && current.getFullYear() === month.getFullYear(),
            });
            cursor.setDate(cursor.getDate() + 1);
        }

        weeks.push({
            id: `week-${weekIndex}`,
            days,
        });
    }

    return weeks;
}

function formatMonthLabel(date: Date) {
    return new Intl.DateTimeFormat("pt-BR", {
        month: "short",
        year: "numeric",
    })
        .format(date)
        .replace(".", "")
        .toUpperCase();
}

function formatDisplayDateFromKey(key: string) {
    const [year, month, day] = key.split("-");
    return `${day}/${month}/${year}`;
}

function parseDisplayDate(value: string) {
    const match = value.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!match) {
        return null;
    }
    const [, day, month, year] = match;
    return `${year}-${month}-${day}`;
}

function combineDateAndTime(dateKey: string, time: string) {
    const normalized = time.trim();
    if (!/^\d{2}:\d{2}$/.test(normalized)) {
        return null;
    }
    const isoCandidate = new Date(`${dateKey}T${normalized}:00`);
    if (Number.isNaN(isoCandidate.getTime())) {
        return null;
    }
    return isoCandidate.toISOString();
}

function formatDateTimeLabel(value: string) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return value;
    }
    const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
        day: "2-digit",
        month: "short",
    });
    const timeFormatter = new Intl.DateTimeFormat("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
    });
    const datePart = dateFormatter.format(date).replace(".", "");
    const timePart = timeFormatter.format(date);
    return `${datePart} às ${timePart}`;
}

function extractTimePart(value: string) {
    const match = value.match(/T(\d{2}:\d{2})/);
    if (match) {
        return match[1];
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return "";
    }
    return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function getPatientDisplayName(appointment: AppointmentListItem) {
    if (appointment.patient?.fullName) {
        return appointment.patient.fullName;
    }
    return `Paciente #${appointment.patientId}`;
}

function getInitials(name?: string | null) {
    if (!name) {
        return "?";
    }
    const parts = name.trim().split(/\s+/);
    if (parts.length === 0) {
        return "?";
    }
    if (parts.length === 1) {
        return parts[0][0]?.toUpperCase() ?? "?";
    }
    const first = parts[0][0] ?? "";
    const last = parts[parts.length - 1][0] ?? "";
    return `${first}${last}`.toUpperCase();
}

function formatCpf(cpf: string) {
    const digits = cpf.replace(/\D/g, "");
    if (digits.length !== 11) {
        return cpf;
    }
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

const ProfessionalScheduleScreen = () => {
    const router = useRouter();
    const queryClient = useQueryClient();

    const todayKey = formatDateKey(new Date());

    const [currentMonth, setCurrentMonth] = useState(() => startOfMonth(new Date()));
    const [selectedDate, setSelectedDate] = useState(todayKey);
    const [isCreateVisible, setIsCreateVisible] = useState(false);
    const [isEditVisible, setIsEditVisible] = useState(false);
    const [isCancelFlow, setIsCancelFlow] = useState(false);
    const [cancelReason, setCancelReason] = useState("");
    const [createPatientInput, setCreatePatientInput] = useState("");
    const [createSelectedPatient, setCreateSelectedPatient] = useState<PatientSummary | null>(null);
    const [createDate, setCreateDate] = useState(formatDisplayDateFromKey(todayKey));
    const [createTime, setCreateTime] = useState("");
    const [createType, setCreateType] = useState<AppointmentType>("treatment");
    const [createError, setCreateError] = useState<string | null>(null);
    const [editingAppointment, setEditingAppointment] = useState<AppointmentListItem | null>(null);
    const [editDate, setEditDate] = useState("");
    const [editTime, setEditTime] = useState("");
    const [editType, setEditType] = useState<AppointmentType>("treatment");
    const [editError, setEditError] = useState<string | null>(null);
    const [cancelError, setCancelError] = useState<string | null>(null);
    const [isRefreshing, setIsRefreshing] = useState(false);

    const {
        data: appointmentsResponse,
        isLoading,
        isError,
        error,
        refetch,
    } = useQuery({
        queryKey: ["professional", "appointments", "schedule"],
        queryFn: () => fetchProfessionalAppointments({ limit: 100 }),
        staleTime: 1000 * 30,
    });

    const appointments = appointmentsResponse?.data ?? [];

    const appointmentsByDate = useMemo(() => {
        const map = new Map<string, AppointmentListItem[]>();

        for (const appointment of appointments) {
            const dateKey = appointment.startsAt.slice(0, 10);
            if (!map.has(dateKey)) {
                map.set(dateKey, []);
            }
            map.get(dateKey)!.push(appointment);
        }

        for (const [dateKey, list] of map.entries()) {
            const sorted = [...list].sort(
                (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
            );
            map.set(dateKey, sorted);
        }

        return map;
    }, [appointments]);

    const datesWithAppointments = useMemo(
        () => new Set(appointmentsByDate.keys()),
        [appointmentsByDate],
    );

    const appointmentsForSelectedDate = appointmentsByDate.get(selectedDate) ?? [];
    const calendarGrid = useMemo(() => buildCalendarGrid(currentMonth), [currentMonth]);
    const calendarMonthLabel = useMemo(() => formatMonthLabel(currentMonth), [currentMonth]);
    const selectedDateLabel = formatDisplayDateFromKey(selectedDate);
    const appointmentCountLabel = `${appointmentsForSelectedDate.length} ${
        appointmentsForSelectedDate.length === 1 ? "consulta" : "consultas"
    }`;
    const scheduleErrorMessage = useMemo(() => {
        if (!isError) {
            return null;
        }
        if (error instanceof Error) {
            return error.message;
        }
        return "Não foi possível carregar a agenda.";
    }, [isError, error]);

    const trimmedPatientSearch = createPatientInput.trim();
    const {
        data: patientSuggestions = [],
        isFetching: isFetchingPatients,
    } = useQuery({
        queryKey: ["professional", "patients", "search", trimmedPatientSearch],
        queryFn: () => searchPatients(trimmedPatientSearch, 5),
        enabled: trimmedPatientSearch.length >= 3 && !createSelectedPatient,
    });

    const createMutation = useMutation({
        mutationFn: createAppointment,
    });

    const updateMutation = useMutation({
        mutationFn: ({
            id,
            input,
        }: {
            id: number;
            input: { startsAt?: string; type?: AppointmentType; notes?: string | null };
        }) => updateAppointment(id, input),
    });

    const statusMutation = useMutation({
        mutationFn: ({
            id,
            status,
            notes,
        }: {
            id: number;
            status: AppointmentStatus;
            notes?: string | null;
        }) => updateAppointmentStatus(id, { status, notes }),
    });

    const handleChangeMonth = useCallback(
        (offset: number) => {
            setCurrentMonth((previous) => {
                const next = addMonths(previous, offset);
                const selectedDateObj = parseDateKey(selectedDate);
                if (
                    selectedDateObj.getMonth() !== next.getMonth() ||
                    selectedDateObj.getFullYear() !== next.getFullYear()
                ) {
                    setSelectedDate(formatDateKey(next));
                }
                return next;
            });
        },
        [selectedDate],
    );

    const handleSelectDate = useCallback((dateKey: string) => {
        setSelectedDate(dateKey);
        setCurrentMonth((previous) => {
            const target = parseDateKey(dateKey);
            if (
                previous.getMonth() === target.getMonth() &&
                previous.getFullYear() === target.getFullYear()
            ) {
                return previous;
            }
            return startOfMonth(target);
        });
    }, []);

    const handleRefresh = useCallback(() => {
        setIsRefreshing(true);
        refetch().finally(() => setIsRefreshing(false));
    }, [refetch]);

    const openCreateModal = useCallback(() => {
        setCreatePatientInput("");
        setCreateSelectedPatient(null);
        setCreateDate(formatDisplayDateFromKey(selectedDate));
        setCreateTime("");
        setCreateType("treatment");
        setCreateError(null);
        setIsCreateVisible(true);
    }, [selectedDate]);

    const closeCreateModal = useCallback(() => {
        setIsCreateVisible(false);
        setCreateError(null);
        setCreatePatientInput("");
        setCreateSelectedPatient(null);
        setCreateTime("");
        setCreateType("treatment");
    }, []);

    const handlePatientInputChange = useCallback(
        (value: string) => {
            setCreatePatientInput(value);
            if (createSelectedPatient && value !== createSelectedPatient.fullName) {
                setCreateSelectedPatient(null);
            }
        },
        [createSelectedPatient],
    );

    const handleSelectPatient = useCallback((patient: PatientSummary) => {
        setCreateSelectedPatient(patient);
        setCreatePatientInput(patient.fullName);
    }, []);

    const handleCreateAppointment = useCallback(async () => {
        if (!createSelectedPatient) {
            setCreateError("Selecione um paciente para continuar.");
            return;
        }
        const parsedDate = parseDisplayDate(createDate) ?? selectedDate;
        const isoStartsAt = combineDateAndTime(parsedDate, createTime);
        if (!isoStartsAt) {
            setCreateError("Informe uma data e horário válidos.");
            return;
        }
        setCreateError(null);
        try {
            await createMutation.mutateAsync({
                patientId: createSelectedPatient.id,
                startsAt: isoStartsAt,
                type: createType,
            });
            await queryClient.invalidateQueries({ queryKey: ["professional", "appointments"] });
            setSelectedDate(parsedDate);
            setCurrentMonth(startOfMonth(parseDateKey(parsedDate)));
            closeCreateModal();
        } catch (mutationError) {
            if (mutationError instanceof Error) {
                setCreateError(mutationError.message);
            } else {
                setCreateError("Não foi possível agendar a consulta.");
            }
        }
    }, [
        createSelectedPatient,
        createDate,
        selectedDate,
        createTime,
        createType,
        createMutation,
        queryClient,
        closeCreateModal,
    ]);

    const openEditModal = useCallback((appointment: AppointmentListItem) => {
        const dateKey = appointment.startsAt.slice(0, 10);
        setEditingAppointment(appointment);
        setEditDate(formatDisplayDateFromKey(dateKey));
        setEditTime(extractTimePart(appointment.startsAt));
        setEditType(appointment.type);
        setEditError(null);
        setCancelError(null);
        setCancelReason("");
        setIsCancelFlow(false);
        setIsEditVisible(true);
    }, []);

    const closeEditModal = useCallback(() => {
        setIsEditVisible(false);
        setEditingAppointment(null);
        setIsCancelFlow(false);
        setCancelReason("");
        setEditError(null);
        setCancelError(null);
    }, []);

    const handleSaveEdit = useCallback(async () => {
        if (!editingAppointment) {
            return;
        }
        const parsedDate = parseDisplayDate(editDate) ?? editingAppointment.startsAt.slice(0, 10);
        const isoStartsAt = combineDateAndTime(parsedDate, editTime);
        if (!isoStartsAt) {
            setEditError("Informe uma data e horário válidos.");
            return;
        }
        const updates: { startsAt?: string; type?: AppointmentType } = {};
        if (new Date(isoStartsAt).getTime() !== new Date(editingAppointment.startsAt).getTime()) {
            updates.startsAt = isoStartsAt;
        }
        if (editType !== editingAppointment.type) {
            updates.type = editType;
        }
        if (Object.keys(updates).length === 0) {
            closeEditModal();
            return;
        }
        setEditError(null);
        try {
            await updateMutation.mutateAsync({ id: editingAppointment.id, input: updates });
            await queryClient.invalidateQueries({ queryKey: ["professional", "appointments"] });
            setSelectedDate(parsedDate);
            setCurrentMonth(startOfMonth(parseDateKey(parsedDate)));
            closeEditModal();
        } catch (mutationError) {
            if (mutationError instanceof Error) {
                setEditError(mutationError.message);
            } else {
                setEditError("Não foi possível salvar as alterações.");
            }
        }
    }, [
        editingAppointment,
        editDate,
        editTime,
        editType,
        updateMutation,
        queryClient,
        closeEditModal,
    ]);

    const handleConfirmCancel = useCallback(async () => {
        if (!editingAppointment) {
            return;
        }
        const parsedDate = editingAppointment.startsAt.slice(0, 10);
        setCancelError(null);
        try {
            await statusMutation.mutateAsync({
                id: editingAppointment.id,
                status: "canceled",
                notes: cancelReason.trim().length > 0 ? cancelReason.trim() : undefined,
            });
            await queryClient.invalidateQueries({ queryKey: ["professional", "appointments"] });
            setSelectedDate(parsedDate);
            setCurrentMonth(startOfMonth(parseDateKey(parsedDate)));
            setIsCancelFlow(false);
            closeEditModal();
        } catch (mutationError) {
            if (mutationError instanceof Error) {
                setCancelError(mutationError.message);
            } else {
                setCancelError("Não foi possível cancelar a consulta.");
            }
        }
    }, [editingAppointment, cancelReason, statusMutation, queryClient, closeEditModal]);

    const handleBackToList = useCallback(() => {
        setIsCancelFlow(false);
        setCancelReason("");
        setCancelError(null);
    }, []);

    const editPatientName = editingAppointment ? getPatientDisplayName(editingAppointment) : "";

    return (
        <Container>
            <View style={styles.screen}>
                <ScrollView
                    style={styles.scroll}
                    contentContainerStyle={styles.content}
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl
                            refreshing={isRefreshing}
                            onRefresh={handleRefresh}
                            colors={["#2563EB"]}
                            progressBackgroundColor="#FFFFFF"
                        />
                    }
                >
                    <View style={styles.header}>
                        <TouchableOpacity
                            style={styles.backButton}
                            activeOpacity={0.8}
                            onPress={() => router.replace("/(professional)/(tabs)")}
                        >
                            <Ionicons name="arrow-back" size={22} color="#111827" />
                        </TouchableOpacity>
                        <Text style={styles.title}>Gerenciar agenda</Text>
                    </View>

                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Gerencie suas consultas</Text>
                        <View style={styles.calendar}>
                            <View style={styles.calendarHeader}>
                                <TouchableOpacity
                                    style={styles.calendarNavButton}
                                    activeOpacity={0.8}
                                    onPress={() => handleChangeMonth(-1)}
                                >
                                    <Ionicons name="chevron-back" size={18} color="#1D4ED8" />
                                </TouchableOpacity>
                                <Text style={styles.calendarMonth}>{calendarMonthLabel}</Text>
                                <TouchableOpacity
                                    style={styles.calendarNavButton}
                                    activeOpacity={0.8}
                                    onPress={() => handleChangeMonth(1)}
                                >
                                    <Ionicons name="chevron-forward" size={18} color="#1D4ED8" />
                                </TouchableOpacity>
                            </View>
                            <View style={styles.calendarWeekdays}>
                                {WEEKDAY_LABELS.map((weekday, index) => (
                                    <Text key={`${weekday}-${index}`} style={styles.calendarWeekdayText}>
                                        {weekday}
                                    </Text>
                                ))}
                            </View>
                            <View style={styles.calendarGrid}>
                                {calendarGrid.map((row) => (
                                    <View key={row.id} style={styles.calendarRow}>
                                        {row.days.map((day) => {
                                            const isSelected = day.date === selectedDate;
                                            const hasAppointments = datesWithAppointments.has(day.date);

                                            return (
                                                <TouchableOpacity
                                                    key={day.date}
                                                    style={[
                                                        styles.calendarCell,
                                                        !day.isCurrentMonth && styles.calendarCellOutside,
                                                        isSelected && styles.calendarCellSelected,
                                                    ]}
                                                    activeOpacity={0.8}
                                                    onPress={() => handleSelectDate(day.date)}
                                                >
                                                    <Text
                                                        style={[
                                                            styles.calendarCellText,
                                                            !day.isCurrentMonth && styles.calendarCellTextMuted,
                                                            isSelected && styles.calendarCellTextSelected,
                                                        ]}
                                                    >
                                                        {day.label}
                                                    </Text>
                                                    <View style={styles.calendarIndicatorWrapper}>
                                                        {hasAppointments ? (
                                                            <View
                                                                style={[
                                                                    styles.calendarIndicator,
                                                                    isSelected && styles.calendarIndicatorSelected,
                                                                    !day.isCurrentMonth && styles.calendarIndicatorMuted,
                                                                ]}
                                                            />
                                                        ) : null}
                                                    </View>
                                                </TouchableOpacity>
                                            );
                                        })}
                                    </View>
                                ))}
                            </View>
                        </View>
                    </View>

                    <View style={styles.summaryRow}>
                        <View style={styles.summaryChipActive}>
                            <Text style={styles.summaryChipTextActive}>{selectedDateLabel}</Text>
                        </View>
                        <View style={styles.summaryChip}>
                            <Text style={styles.summaryChipText}>{appointmentCountLabel}</Text>
                        </View>
                    </View>

                    <View style={styles.appointmentList}>
                        {isLoading && appointments.length === 0 ? (
                            <View style={styles.loadingState}>
                                <ActivityIndicator size="small" color="#2563EB" />
                                <Text style={styles.loadingText}>Carregando agenda...</Text>
                            </View>
                        ) : scheduleErrorMessage ? (
                            <View style={styles.errorState}>
                                <Ionicons name="warning" size={20} color="#B91C1C" />
                                <Text style={styles.errorText}>{scheduleErrorMessage}</Text>
                                <TouchableOpacity
                                    style={styles.retryButton}
                                    activeOpacity={0.85}
                                    onPress={() => refetch()}
                                >
                                    <Text style={styles.retryButtonText}>Tentar novamente</Text>
                                </TouchableOpacity>
                            </View>
                        ) : appointmentsForSelectedDate.length === 0 ? (
                            <View style={styles.emptyState}>
                                <Ionicons name="calendar-outline" size={24} color="#64748B" />
                                <Text style={styles.emptyStateText}>Nenhuma consulta para este dia.</Text>
                            </View>
                        ) : (
                            appointmentsForSelectedDate.map((appointment) => {
                                const typeLabel =
                                    TYPE_OPTIONS.find((option) => option.value === appointment.type)?.label ??
                                    "Consulta";
                                const patientName = getPatientDisplayName(appointment);
                                const initials = getInitials(patientName);
                                const statusStyle =
                                    APPOINTMENT_STATUS_BADGE_STYLES[appointment.status] ?? {
                                        bg: "#E2E8F0",
                                        text: "#1F2937",
                                    };
                                const statusLabel =
                                    APPOINTMENT_STATUS_LABELS[appointment.status] ?? "Status indefinido";
                                const accent = TYPE_ACCENTS[appointment.type];
                                const summary = formatDateTimeLabel(appointment.startsAt);
                                const isCanceled = appointment.status === "canceled";

                                return (
                                    <TouchableOpacity
                                        key={appointment.id}
                                        style={[
                                            styles.appointmentCard,
                                            isCanceled && styles.appointmentCardCanceled,
                                        ]}
                                        activeOpacity={0.85}
                                        onPress={() => openEditModal(appointment)}
                                    >
                                        <View style={[styles.appointmentAvatar, { backgroundColor: accent }]}>
                                            <Text style={styles.appointmentAvatarText}>{initials}</Text>
                                        </View>
                                        <View style={styles.appointmentInfo}>
                                            <Text style={styles.appointmentPatient}>{patientName}</Text>
                                            <Text style={styles.appointmentType}>{typeLabel}</Text>
                                            <View style={styles.appointmentMeta}>
                                                <Ionicons name="calendar" size={14} color="#475569" />
                                                <Text style={styles.appointmentMetaText}>{summary}</Text>
                                            </View>
                                            <View style={styles.appointmentBadgeRow}>
                                                <View style={[styles.statusBadge, { backgroundColor: statusStyle.bg }]}>
                                                    <Text style={[styles.statusBadgeText, { color: statusStyle.text }]}>
                                                        {statusLabel}
                                                    </Text>
                                                </View>
                                            </View>
                                        </View>
                                    </TouchableOpacity>
                                );
                            })
                        )}
                    </View>
                </ScrollView>

                <TouchableOpacity style={styles.fab} activeOpacity={0.9} onPress={openCreateModal}>
                    <Ionicons name="add" size={24} color="#FFFFFF" />
                </TouchableOpacity>

                <Modal
                    transparent
                    visible={isCreateVisible}
                    animationType="fade"
                    onRequestClose={closeCreateModal}
                >
                    <View style={styles.modalOverlay}>
                        <View style={styles.modalCard}>
                            <Text style={styles.modalTitle}>Agendar consulta</Text>
                            <View style={styles.modalInputGroup}>
                                <View>
                                    <View style={styles.modalInputWrapper}>
                                        <Ionicons name="person" size={18} color="#475569" />
                                        <TextInput
                                            style={styles.modalInput}
                                            value={createPatientInput}
                                            onChangeText={handlePatientInputChange}
                                            placeholder="Nome do paciente"
                                            placeholderTextColor="#94A3B8"
                                            autoCapitalize="words"
                                        />
                                    </View>
                                    {createSelectedPatient ? (
                                        <View style={styles.suggestionSelected}>
                                            <Text style={styles.suggestionSelectedText}>
                                                CPF {formatCpf(createSelectedPatient.cpf)} · {PATIENT_STATUS_LABELS[createSelectedPatient.status] ?? createSelectedPatient.status}
                                            </Text>
                                        </View>
                                    ) : null}
                                    {trimmedPatientSearch.length >= 3 && !createSelectedPatient ? (
                                        <View style={styles.suggestionsContainer}>
                                            {isFetchingPatients ? (
                                                <View style={styles.suggestionsLoading}>
                                                    <ActivityIndicator size="small" color="#2563EB" />
                                                    <Text style={styles.suggestionInfo}>Buscando pacientes...</Text>
                                                </View>
                                            ) : patientSuggestions.length === 0 ? (
                                                <Text style={styles.suggestionsEmpty}>Nenhum paciente encontrado.</Text>
                                            ) : (
                                                patientSuggestions.map((patient) => (
                                                    <TouchableOpacity
                                                        key={patient.id}
                                                        style={styles.suggestionItem}
                                                        activeOpacity={0.85}
                                                        onPress={() => handleSelectPatient(patient)}
                                                    >
                                                        <Text style={styles.suggestionName}>{patient.fullName}</Text>
                                                        <Text style={styles.suggestionInfo}>
                                                            CPF {formatCpf(patient.cpf)} · {PATIENT_STATUS_LABELS[patient.status] ?? patient.status}
                                                        </Text>
                                                    </TouchableOpacity>
                                                ))
                                            )}
                                    </View>
                                ) : null}
                                </View>

                                <View style={styles.modalDateRow}>
                                    <View style={styles.modalDateInput}>
                                        <Ionicons name="calendar" size={18} color="#475569" />
                                        <TextInput
                                            style={styles.modalDateText}
                                            value={createDate}
                                            onChangeText={setCreateDate}
                                            placeholder="00/00/0000"
                                            placeholderTextColor="#94A3B8"
                                            keyboardType="numbers-and-punctuation"
                                        />
                                    </View>
                                    <View style={styles.modalDateInput}>
                                        <Ionicons name="time" size={18} color="#475569" />
                                        <TextInput
                                            style={styles.modalDateText}
                                            value={createTime}
                                            onChangeText={setCreateTime}
                                            placeholder="00:00"
                                            placeholderTextColor="#94A3B8"
                                            keyboardType="numbers-and-punctuation"
                                        />
                                    </View>
                                </View>
                            </View>

                            <Text style={styles.modalSectionLabel}>Tipo de consulta</Text>
                            <View style={styles.modalTypeRow}>
                                {TYPE_OPTIONS.map((option) => {
                                    const isSelected = createType === option.value;
                                    return (
                                        <TouchableOpacity
                                            key={option.value}
                                            style={[styles.modalTypeChip, isSelected && styles.modalTypeChipSelected]}
                                            activeOpacity={0.85}
                                            onPress={() => setCreateType(option.value)}
                                        >
                                            <Text
                                                style={[styles.modalTypeText, isSelected && styles.modalTypeTextSelected]}
                                            >
                                                {option.label}
                                            </Text>
                                        </TouchableOpacity>
                                );
                                })}
                            </View>

                            {createError ? <Text style={styles.modalErrorText}>{createError}</Text> : null}

                            <View style={styles.modalActions}>
                                <TouchableOpacity
                                    style={[
                                        styles.modalPrimaryButton,
                                        createMutation.isPending && styles.modalPrimaryButtonDisabled,
                                    ]}
                                    activeOpacity={0.9}
                                    onPress={handleCreateAppointment}
                                    disabled={createMutation.isPending}
                                >
                                    {createMutation.isPending ? (
                                        <ActivityIndicator size="small" color="#FFFFFF" />
                                    ) : (
                                        <Text style={styles.modalPrimaryText}>Agendar consulta</Text>
                                    )}
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={styles.modalSecondaryButton}
                                    activeOpacity={0.85}
                                    onPress={closeCreateModal}
                                >
                                    <Text style={styles.modalSecondaryText}>Cancelar</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </Modal>

                <Modal
                    transparent
                    visible={isEditVisible}
                    animationType="fade"
                    onRequestClose={closeEditModal}
                >
                    <View style={styles.modalOverlay}>
                        <View style={styles.modalCard}>
                            <Text style={styles.modalTitle}>Editar consulta</Text>

                            {isCancelFlow ? (
                                <View style={styles.cancelSection}>
                                    <Text style={styles.modalSectionLabel}>Motivo do cancelamento</Text>
                                    <View style={styles.modalTextareaWrapper}>
                                        <TextInput
                                            style={styles.modalTextarea}
                                            value={cancelReason}
                                            onChangeText={setCancelReason}
                                            placeholder="Descreva o motivo"
                                            placeholderTextColor="#94A3B8"
                                            multiline
                                            textAlignVertical="top"
                                        />
                                    </View>
                                    {cancelError ? <Text style={styles.modalErrorText}>{cancelError}</Text> : null}
                                    <View style={styles.modalActions}>
                                        <TouchableOpacity
                                            style={[
                                                styles.modalDangerButtonFilled,
                                                statusMutation.isPending && styles.modalDangerButtonDisabled,
                                            ]}
                                            activeOpacity={0.9}
                                            onPress={handleConfirmCancel}
                                            disabled={statusMutation.isPending}
                                        >
                                            {statusMutation.isPending ? (
                                                <ActivityIndicator size="small" color="#FFFFFF" />
                                            ) : (
                                                <Text style={styles.modalDangerTextFilled}>Confirmar cancelamento</Text>
                                            )}
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={styles.modalSecondaryButton}
                                            activeOpacity={0.85}
                                            onPress={handleBackToList}
                                        >
                                            <Text style={styles.modalSecondaryText}>Voltar</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            ) : (
                                <>
                                    <View style={styles.modalInputGroup}>
                                        <View style={styles.modalInputWrapper}>
                                            <Ionicons name="person" size={18} color="#475569" />
                                            <TextInput
                                                style={styles.modalInput}
                                                value={editPatientName}
                                                editable={false}
                                            />
                                        </View>

                                        <View style={styles.modalDateRow}>
                                            <View style={styles.modalDateInput}>
                                                <Ionicons name="calendar" size={18} color="#475569" />
                                                <TextInput
                                                    style={styles.modalDateText}
                                                    value={editDate}
                                                    onChangeText={setEditDate}
                                                    placeholder="00/00/0000"
                                                    placeholderTextColor="#94A3B8"
                                                    keyboardType="numbers-and-punctuation"
                                                />
                                            </View>
                                            <View style={styles.modalDateInput}>
                                                <Ionicons name="time" size={18} color="#475569" />
                                                <TextInput
                                                    style={styles.modalDateText}
                                                    value={editTime}
                                                    onChangeText={setEditTime}
                                                    placeholder="00:00"
                                                    placeholderTextColor="#94A3B8"
                                                    keyboardType="numbers-and-punctuation"
                                                />
                                            </View>
                                        </View>
                                    </View>

                                    <Text style={styles.modalSectionLabel}>Tipo de consulta</Text>
                                    <View style={styles.modalTypeRow}>
                                        {TYPE_OPTIONS.map((option) => {
                                            const isSelected = editType === option.value;
                                            return (
                                                <TouchableOpacity
                                                    key={option.value}
                                                    style={[styles.modalTypeChip, isSelected && styles.modalTypeChipSelected]}
                                                    activeOpacity={0.85}
                                                    onPress={() => setEditType(option.value)}
                                                >
                                                    <Text
                                                        style={[styles.modalTypeText, isSelected && styles.modalTypeTextSelected]}
                                                    >
                                                        {option.label}
                                                    </Text>
                                                </TouchableOpacity>
                                            );
                                        })}
                                    </View>

                                    {editError ? <Text style={styles.modalErrorText}>{editError}</Text> : null}

                                    <View style={styles.modalActions}>
                                        <TouchableOpacity
                                            style={[
                                                styles.modalPrimaryButton,
                                                updateMutation.isPending && styles.modalPrimaryButtonDisabled,
                                            ]}
                                            activeOpacity={0.9}
                                            onPress={handleSaveEdit}
                                            disabled={updateMutation.isPending}
                                        >
                                            {updateMutation.isPending ? (
                                                <ActivityIndicator size="small" color="#FFFFFF" />
                                            ) : (
                                                <Text style={styles.modalPrimaryText}>Salvar alterações</Text>
                                            )}
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={styles.modalSecondaryButton}
                                            activeOpacity={0.85}
                                            onPress={closeEditModal}
                                        >
                                            <Text style={styles.modalSecondaryText}>Cancelar</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={styles.modalDangerButton}
                                            activeOpacity={0.85}
                                            onPress={() => setIsCancelFlow(true)}
                                        >
                                            <Text style={styles.modalDangerText}>Cancelar consulta</Text>
                                        </TouchableOpacity>
                                    </View>
                                </>
                            )}
                        </View>
                    </View>
                </Modal>
            </View>
        </Container>
    );
};

const styles = StyleSheet.create({
    screen: {
        flex: 1,
        position: "relative",
        paddingHorizontal: 20,
    },
    scroll: {
        flex: 1,
    },
    content: {
        paddingBottom: 72,
        gap: 24,
    },
    header: {
        flexDirection: "row",
        alignItems: "center",
        gap: 16,
        paddingTop: 12,
    },
    backButton: {
        width: 42,
        height: 42,
        borderRadius: 21,
        borderWidth: 1,
        borderColor: "#E2E8F0",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#FFFFFF",
    },
    title: {
        flex: 1,
        fontSize: 22,
        fontWeight: "700",
        color: "#111827",
    },
    section: {
        gap: 16,
    },
    sectionTitle: {
        fontSize: 17,
        fontWeight: "600",
        color: "#111827",
    },
    calendar: {
        borderWidth: 1,
        borderColor: "#CBD5F5",
        borderRadius: 20,
        paddingVertical: 18,
        paddingHorizontal: 16,
        gap: 16,
        backgroundColor: "#FFFFFF",
    },
    calendarHeader: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
    calendarNavButton: {
        width: 32,
        height: 32,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: "#CBD5F5",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#FFFFFF",
    },
    calendarMonth: {
        fontSize: 14,
        fontWeight: "600",
        color: "#1E3A8A",
        letterSpacing: 1,
    },
    calendarWeekdays: {
        flexDirection: "row",
        justifyContent: "space-between",
    },
    calendarWeekdayText: {
        width: 36,
        textAlign: "center",
        fontSize: 12,
        color: "#64748B",
        fontWeight: "600",
        textTransform: "uppercase",
    },
    calendarGrid: {
        gap: 12,
    },
    calendarRow: {
        flexDirection: "row",
        justifyContent: "space-between",
    },
    calendarCell: {
        width: 36,
        height: 44,
        borderRadius: 12,
        alignItems: "center",
        justifyContent: "flex-start",
        paddingTop: 6,
        paddingBottom: 6,
    },
    calendarCellSelected: {
        backgroundColor: "#2563EB",
    },
    calendarCellOutside: {
        opacity: 0.6,
    },
    calendarCellText: {
        fontSize: 14,
        color: "#1F2937",
    },
    calendarCellTextMuted: {
        color: "#94A3B8",
    },
    calendarCellTextSelected: {
        color: "#FFFFFF",
        fontWeight: "600",
    },
    calendarIndicatorWrapper: {
        marginTop: 4,
        height: 6,
        alignItems: "center",
        justifyContent: "center",
    },
    calendarIndicator: {
        width: 6,
        height: 6,
        borderRadius: 99,
        backgroundColor: "#2563EB",
        opacity: 0.8,
    },
    calendarIndicatorSelected: {
        backgroundColor: "#FFFFFF",
        opacity: 1,
    },
    calendarIndicatorMuted: {
        backgroundColor: "#CBD5F5",
    },
    summaryRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
    },
    summaryChip: {
        borderRadius: 16,
        borderWidth: 1,
        borderColor: "#CBD5F5",
        paddingHorizontal: 16,
        paddingVertical: 10,
    },
    summaryChipActive: {
        borderRadius: 16,
        backgroundColor: "#2563EB",
        paddingHorizontal: 16,
        paddingVertical: 10,
    },
    summaryChipText: {
        fontSize: 13,
        color: "#1F2937",
        fontWeight: "500",
    },
    summaryChipTextActive: {
        fontSize: 13,
        color: "#FFFFFF",
        fontWeight: "600",
    },
    appointmentList: {
        gap: 12,
    },
    appointmentCard: {
        flexDirection: "row",
        alignItems: "center",
        borderRadius: 18,
        borderWidth: 1,
        borderColor: "#E2E8F0",
        padding: 16,
        gap: 16,
        backgroundColor: "#FFFFFF",
    },
    appointmentCardCanceled: {
        opacity: 0.7,
    },
    appointmentAvatar: {
        width: 52,
        height: 52,
        borderRadius: 16,
        alignItems: "center",
        justifyContent: "center",
    },
    appointmentAvatarText: {
        fontSize: 18,
        fontWeight: "700",
        color: "#FFFFFF",
    },
    appointmentInfo: {
        flex: 1,
        gap: 4,
    },
    appointmentPatient: {
        fontSize: 16,
        fontWeight: "600",
        color: "#1F2937",
    },
    appointmentType: {
        fontSize: 13,
        color: "#2563EB",
        fontWeight: "500",
    },
    appointmentMeta: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
    },
    appointmentMetaText: {
        fontSize: 12,
        color: "#475569",
    },
    appointmentBadgeRow: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 8,
        marginTop: 8,
    },
    statusBadge: {
        borderRadius: 999,
        paddingHorizontal: 12,
        paddingVertical: 4,
    },
    statusBadgeText: {
        fontSize: 12,
        fontWeight: "600",
    },
    emptyState: {
        borderRadius: 18,
        borderWidth: 1,
        borderColor: "#E2E8F0",
        backgroundColor: "#F8FAFC",
        paddingVertical: 24,
        alignItems: "center",
        gap: 8,
    },
    emptyStateText: {
        fontSize: 14,
        color: "#475569",
    },
    loadingState: {
        marginTop: 24,
        alignItems: "center",
        gap: 12,
    },
    loadingText: {
        fontSize: 13,
        color: "#475569",
    },
    errorState: {
        marginTop: 24,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: "#FCA5A5",
        backgroundColor: "#FEF2F2",
        padding: 20,
        alignItems: "center",
        gap: 12,
    },
    errorText: {
        fontSize: 14,
        color: "#991B1B",
        textAlign: "center",
        lineHeight: 20,
    },
    retryButton: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 12,
        backgroundColor: "#1D4ED8",
    },
    retryButtonText: {
        fontSize: 13,
        fontWeight: "600",
        color: "#FFFFFF",
    },
    fab: {
        position: "absolute",
        right: 24,
        bottom: 24,
        width: 52,
        height: 52,
        borderRadius: 26,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#2563EB",
        shadowColor: "#0F172A",
        shadowOpacity: 0.2,
        shadowOffset: { width: 0, height: 4 },
        shadowRadius: 10,
        elevation: 6,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: "rgba(15, 23, 42, 0.35)",
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 24,
    },
    modalCard: {
        width: "100%",
        borderRadius: 24,
        backgroundColor: "#FFFFFF",
        paddingVertical: 28,
        paddingHorizontal: 24,
        gap: 20,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: "700",
        color: "#111827",
        textAlign: "center",
    },
    modalInputGroup: {
        gap: 16,
    },
    modalInputWrapper: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: "#CBD5F5",
        paddingHorizontal: 16,
        height: 52,
        backgroundColor: "#FFFFFF",
    },
    modalInput: {
        flex: 1,
        fontSize: 15,
        color: "#1F2937",
    },
    modalDateRow: {
        flexDirection: "row",
        gap: 12,
    },
    modalDateInput: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        height: 52,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: "#CBD5F5",
        paddingHorizontal: 16,
        backgroundColor: "#FFFFFF",
    },
    modalDateText: {
        flex: 1,
        fontSize: 15,
        color: "#1F2937",
    },
    modalSectionLabel: {
        fontSize: 15,
        fontWeight: "600",
        color: "#111827",
    },
    modalTypeRow: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 12,
    },
    modalTypeChip: {
        borderRadius: 18,
        borderWidth: 1,
        borderColor: "#CBD5F5",
        paddingHorizontal: 16,
        paddingVertical: 10,
        backgroundColor: "#FFFFFF",
    },
    modalTypeChipSelected: {
        backgroundColor: "#1D4ED8",
        borderColor: "#1D4ED8",
    },
    modalTypeText: {
        fontSize: 14,
        color: "#1F2937",
        fontWeight: "500",
    },
    modalTypeTextSelected: {
        color: "#FFFFFF",
    },
    suggestionsContainer: {
        marginTop: 8,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: "#E2E8F0",
        backgroundColor: "#FFFFFF",
        paddingVertical: 8,
        gap: 4,
        maxHeight: 180,
    },
    suggestionsLoading: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        paddingHorizontal: 16,
        paddingVertical: 8,
    },
    suggestionsEmpty: {
        paddingHorizontal: 16,
        paddingVertical: 10,
        fontSize: 13,
        color: "#64748B",
    },
    suggestionItem: {
        paddingHorizontal: 16,
        paddingVertical: 10,
        gap: 4,
    },
    suggestionName: {
        fontSize: 14,
        fontWeight: "600",
        color: "#1F2937",
    },
    suggestionInfo: {
        fontSize: 12,
        color: "#64748B",
    },
    suggestionSelected: {
        marginTop: 8,
        paddingHorizontal: 16,
        paddingVertical: 6,
        borderRadius: 12,
        backgroundColor: "#EEF2FF",
    },
    suggestionSelectedText: {
        fontSize: 12,
        color: "#1D4ED8",
    },
    modalErrorText: {
        fontSize: 13,
        color: "#B91C1C",
        textAlign: "center",
    },
    modalActions: {
        gap: 12,
    },
    modalPrimaryButton: {
        height: 52,
        borderRadius: 18,
        backgroundColor: "#2563EB",
        alignItems: "center",
        justifyContent: "center",
    },
    modalPrimaryButtonDisabled: {
        opacity: 0.7,
    },
    modalPrimaryText: {
        fontSize: 15,
        fontWeight: "600",
        color: "#FFFFFF",
    },
    modalSecondaryButton: {
        height: 52,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: "#CBD5F5",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#FFFFFF",
    },
    modalSecondaryText: {
        fontSize: 15,
        fontWeight: "600",
        color: "#111827",
    },
    cancelSection: {
        gap: 16,
    },
    modalTextareaWrapper: {
        borderRadius: 16,
        borderWidth: 1,
        borderColor: "#FECACA",
        backgroundColor: "#FEF2F2",
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    modalTextarea: {
        minHeight: 100,
        fontSize: 15,
        color: "#1F2937",
    },
    modalDangerButton: {
        height: 52,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: "#FCA5A5",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#FEF2F2",
    },
    modalDangerText: {
        fontSize: 15,
        fontWeight: "600",
        color: "#B91C1C",
    },
    modalDangerButtonFilled: {
        height: 52,
        borderRadius: 18,
        backgroundColor: "#DC2626",
        alignItems: "center",
        justifyContent: "center",
    },
    modalDangerButtonDisabled: {
        opacity: 0.7,
    },
    modalDangerTextFilled: {
        fontSize: 15,
        fontWeight: "600",
        color: "#FFFFFF",
    },
});

export default ProfessionalScheduleScreen;
