import { Container } from "@/components/container";
import {
    AppointmentListItem,
    AppointmentStatus,
    AppointmentType,
    fetchProfessionalAppointments,
} from "@/lib/api";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import {
    ActivityIndicator,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";

const STATUS_LABELS: Record<AppointmentStatus, string> = {
    scheduled: "Agendada",
    confirmed: "Confirmada",
    completed: "Concluída",
    no_show: "Faltou",
    canceled: "Cancelada",
};

const STATUS_BADGE_STYLES: Record<AppointmentStatus, { bg: string; text: string }> = {
    scheduled: { bg: "#E0F2FE", text: "#0369A1" },
    confirmed: { bg: "#DCFCE7", text: "#166534" },
    completed: { bg: "#F5F3FF", text: "#4C1D95" },
    no_show: { bg: "#FEE2E2", text: "#B91C1C" },
    canceled: { bg: "#E2E8F0", text: "#1F2937" },
};

const TYPE_LABELS: Record<AppointmentType, string> = {
    triage: "Triagem",
    treatment: "Tratamento",
    return: "Retorno",
};

const TYPE_ACCENTS: Record<AppointmentType, string> = {
    triage: "#2563EB",
    treatment: "#0EA5E9",
    return: "#7C3AED",
};

function formatDateTime(value: string) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return value;
    }
    const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
        day: "2-digit",
        month: "short",
        year: "numeric",
    });
    const timeFormatter = new Intl.DateTimeFormat("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
    });

    const datePart = dateFormatter.format(date);
    const timePart = timeFormatter.format(date);
    return `${datePart} às ${timePart}`;
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
    const [first, last] = [parts[0], parts[parts.length - 1]];
    return `${first[0] ?? ""}${last[0] ?? ""}`.toUpperCase();
}

function getPatientDisplayName(appointment: AppointmentListItem) {
    if (appointment.patient?.fullName) {
        return appointment.patient.fullName;
    }
    return `Paciente #${appointment.patientId}`;
}

const ProfessionalAppointmentsScreen = () => {
    const router = useRouter();
    const [refreshing, setRefreshing] = useState(false);

    const {
        data,
        isLoading,
        isError,
        error,
        refetch,
    } = useQuery({
        queryKey: ["professional", "appointments"],
        queryFn: () => fetchProfessionalAppointments({ limit: 50 }),
        staleTime: 1000 * 30,
    });

    const appointments = useMemo(() => data?.data ?? [], [data]);

    const handleRefresh = useCallback(() => {
        setRefreshing(true);
        refetch().finally(() => {
            setRefreshing(false);
        });
    }, [refetch]);

    const errorMessage = useMemo(() => {
        if (error instanceof Error) {
            return error.message;
        }
        return "Não foi possível carregar os atendimentos.";
    }, [error]);

    return (
        <Container>
            <View style={styles.screen}>
                <View style={styles.header}>
                    <TouchableOpacity
                        style={styles.backButton}
                        activeOpacity={0.8}
                        onPress={() => router.replace("/(professional)/(tabs)/workspace")}
                    >
                        <Ionicons name="arrow-back" size={22} color="#111827" />
                    </TouchableOpacity>
                    <Text style={styles.title}>Meus atendimentos</Text>
                </View>

                <ScrollView
                    style={styles.scroll}
                    contentContainerStyle={styles.content}
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={handleRefresh}
                            colors={["#2563EB"]}
                            progressBackgroundColor="#FFFFFF"
                        />
                    }
                >
                    <Text style={styles.subtitle}>Consultas marcadas</Text>

                    {isLoading && !refreshing ? (
                        <View style={styles.loadingContainer}>
                            <ActivityIndicator size="small" color="#2563EB" />
                            <Text style={styles.loadingText}>Carregando atendimentos...</Text>
                        </View>
                    ) : null}

                    {isError ? (
                        <View style={styles.errorState}>
                            <Ionicons name="warning" size={20} color="#B91C1C" />
                            <Text style={styles.errorText}>{errorMessage}</Text>
                            <TouchableOpacity
                                style={styles.retryButton}
                                activeOpacity={0.85}
                                onPress={() => refetch()}
                            >
                                <Text style={styles.retryButtonText}>Tentar novamente</Text>
                            </TouchableOpacity>
                        </View>
                    ) : null}

                    {!isLoading && !isError && appointments.length === 0 ? (
                        <View style={styles.emptyState}>
                            <Ionicons name="calendar-outline" size={28} color="#2563EB" />
                            <Text style={styles.emptyTitle}>Nenhum atendimento agendado</Text>
                            <Text style={styles.emptyText}>
                                Cadastre uma nova consulta para visualizar aqui sua agenda.
                            </Text>
                        </View>
                    ) : null}

                    <View style={styles.list}>
                        {appointments.map((appointment) => {
                            const typeAccent = TYPE_ACCENTS[appointment.type];
                            const statusStyle = STATUS_BADGE_STYLES[appointment.status];
                            const patientName = getPatientDisplayName(appointment);
                            const initials = getInitials(patientName);

                            return (
                                <View key={appointment.id} style={styles.card}>
                                    <View style={[styles.cardIcon, { backgroundColor: typeAccent }]}>
                                        <Text style={styles.iconInitials}>{initials}</Text>
                                    </View>
                                    <View style={styles.cardBody}>
                                        <Text style={styles.patient}>{patientName}</Text>
                                        <Text style={styles.type}>{TYPE_LABELS[appointment.type]}</Text>
                                        <View style={styles.metaRow}>
                                            <Ionicons name="calendar" size={14} color="#475569" />
                                            <Text style={styles.metaText}>{formatDateTime(appointment.startsAt)}</Text>
                                        </View>
                                        <View style={styles.badgeRow}>
                                            <View style={[styles.statusBadge, { backgroundColor: statusStyle.bg }]}>
                                                <Text style={[styles.statusBadgeText, { color: statusStyle.text }]}>
                                                    {STATUS_LABELS[appointment.status]}
                                                </Text>
                                            </View>
                                        </View>
                                    </View>
                                </View>
                            );
                        })}
                    </View>
                </ScrollView>
            </View>
        </Container>
    );
};

const styles = StyleSheet.create({
    screen: {
        flex: 1,
        paddingHorizontal: 20,
        paddingTop: 12,
        backgroundColor: "#FFFFFF",
    },
    header: {
        flexDirection: "row",
        alignItems: "center",
        gap: 16,
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: "#E2E8F0",
        alignItems: "center",
        justifyContent: "center",
    },
    title: {
        flex: 1,
        fontSize: 22,
        fontWeight: "700",
        color: "#111827",
    },
    scroll: {
        flex: 1,
        marginTop: 24,
    },
    content: {
        paddingBottom: 48,
        gap: 16,
    },
    subtitle: {
        fontSize: 16,
        fontWeight: "600",
        color: "#111827",
    },
    list: {
        gap: 12,
    },
    card: {
        flexDirection: "row",
        gap: 16,
        padding: 16,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: "#E2E8F0",
        backgroundColor: "#FFFFFF",
        alignItems: "center",
        shadowColor: "#0F172A",
        shadowOpacity: 0.04,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 4 },
        elevation: 2,
    },
    cardIcon: {
        width: 56,
        height: 56,
        borderRadius: 18,
        alignItems: "center",
        justifyContent: "center",
    },
    iconInitials: {
        fontSize: 18,
        fontWeight: "700",
        color: "#FFFFFF",
    },
    cardBody: {
        flex: 1,
        gap: 6,
    },
    patient: {
        fontSize: 16,
        fontWeight: "600",
        color: "#111827",
    },
    type: {
        fontSize: 13,
        color: "#475569",
    },
    metaRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        marginTop: 4,
    },
    metaText: {
        fontSize: 13,
        color: "#475569",
    },
    badgeRow: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 8,
        marginTop: 8,
    },
    statusBadge: {
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 999,
    },
    statusBadgeText: {
        fontSize: 12,
        fontWeight: "600",
    },
    loadingContainer: {
        marginTop: 24,
        alignItems: "center",
        gap: 12,
    },
    loadingText: {
        fontSize: 13,
        color: "#475569",
    },
    emptyState: {
        marginTop: 32,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: "#BFDBFE",
        backgroundColor: "#F8FBFF",
        padding: 24,
        alignItems: "center",
        gap: 12,
    },
    emptyTitle: {
        fontSize: 16,
        fontWeight: "600",
        color: "#1F2937",
    },
    emptyText: {
        fontSize: 14,
        color: "#475569",
        textAlign: "center",
        lineHeight: 20,
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
});

export default ProfessionalAppointmentsScreen;
