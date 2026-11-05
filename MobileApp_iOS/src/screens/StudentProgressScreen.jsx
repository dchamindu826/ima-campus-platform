import React, { useState, useEffect, useContext, useMemo } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, ScrollView,
    ActivityIndicator, Dimensions, StatusBar, Platform, RefreshControl, Image
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import api from '../services/api';
import COLORS from '../constants/colors';
import { AuthContext } from '../context/AuthContext';

const { width } = Dimensions.get('window');

const StudentProgressScreen = ({ navigation }) => {
    const insets = useSafeAreaInsets();
    const { userInfo } = useContext(AuthContext);

    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [progressData, setProgressData] = useState(null);

    // Active Category Tab: 'WEEKLY' | 'MONTHLY'
    const [activeCategory, setActiveCategory] = useState('WEEKLY');

    // Type Filter: 'ALL' | 'MCQ' | 'STRUCTURED' | 'BOTH'
    const [typeFilter, setTypeFilter] = useState('ALL');

    // Selected chart point for tooltip
    const [selectedPoint, setSelectedPoint] = useState(null);

    useEffect(() => {
        fetchProgress();
    }, []);

    const fetchProgress = async () => {
        try {
            setLoading(true);
            const res = await api.get('papers/student/progress');
            setProgressData(res.data);
            setSelectedPoint(null);
        } catch (err) {
            console.error("Failed to load progress data", err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const onRefresh = () => {
        setRefreshing(true);
        fetchProgress();
    };

    // Filter tests for the active category and selected type
    const currentCategoryData = useMemo(() => {
        if (!progressData) return { totalTaken: 0, averageScore: 0, highestScore: 0, averagePercentage: 0, passRate: 0, history: [] };
        return activeCategory === 'WEEKLY' ? progressData.weekly : progressData.monthly;
    }, [progressData, activeCategory]);

    const filteredHistory = useMemo(() => {
        if (!currentCategoryData?.history) return [];
        if (typeFilter === 'ALL') return currentCategoryData.history;
        return currentCategoryData.history.filter(item => item.paperType === typeFilter);
    }, [currentCategoryData, typeFilter]);

    // Filtered chart data points for the active category & type
    const categoryChartData = useMemo(() => {
        if (!progressData?.chartData) return [];
        return progressData.chartData.filter(pt => {
            const matchesCat = pt.category === activeCategory;
            const matchesType = typeFilter === 'ALL' || pt.paperType === typeFilter;
            return matchesCat && matchesType;
        });
    }, [progressData, activeCategory, typeFilter]);

    // Format date e.g. "Sep 15"
    const formatDate = (dateStr) => {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };

    if (loading && !refreshing) {
        return (
            <View style={[styles.centerContainer, { paddingTop: insets.top }]}>
                <StatusBar barStyle="light-content" backgroundColor="#0a0f1d" />
                <ActivityIndicator size="large" color={COLORS.primary || '#D32F2F'} />
                <Text style={styles.loadingText}>Loading progress analytics...</Text>
            </View>
        );
    }

    return (
        <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
            <StatusBar barStyle="light-content" backgroundColor="#0a0f1d" />

            {/* 🌟 HEADER BAR 🌟 */}
            <View style={styles.header}>
                <TouchableOpacity
                    onPress={() => navigation.goBack()}
                    style={styles.backBtn}
                    activeOpacity={0.7}
                >
                    <Icon name="arrow-left" size={22} color="#ffffff" />
                </TouchableOpacity>

                <Image
                    source={require('../assets/logo_white.png')}
                    style={styles.headerLogo}
                    resizeMode="contain"
                />

                <View style={styles.headerTitleWrap}>
                    <Text style={styles.headerTitle}>Exam Progress & Analytics</Text>
                    <Text style={styles.headerSubTitle}>
                        {userInfo?.name || `${userInfo?.firstName || 'Student'} ${userInfo?.lastName || ''}`.trim()}
                    </Text>
                </View>

                <TouchableOpacity
                    onPress={fetchProgress}
                    style={styles.refreshBtn}
                    activeOpacity={0.7}
                >
                    <Icon name="refresh" size={20} color="#94a3b8" />
                </TouchableOpacity>
            </View>

            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#D32F2F" />
                }
            >
                {/* 🌟 1. CATEGORY SWITCHER (WEEKLY VS. MONTHLY) 🌟 */}
                <View style={styles.categorySwitchContainer}>
                    <TouchableOpacity
                        style={[
                            styles.categorySwitchBtn,
                            activeCategory === 'WEEKLY' && styles.categorySwitchBtnActiveWeekly
                        ]}
                        onPress={() => {
                            setActiveCategory('WEEKLY');
                            setSelectedPoint(null);
                        }}
                        activeOpacity={0.8}
                    >
                        <View style={[styles.catIconBox, activeCategory === 'WEEKLY' && styles.catIconBoxActiveWeekly]}>
                            <Text style={styles.catEmoji}>⚡</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={[styles.catBtnTitle, activeCategory === 'WEEKLY' && styles.catBtnTitleActiveWeekly]}>
                                Weekly Tests
                            </Text>
                            <Text style={styles.catBtnCount}>
                                {progressData?.weekly?.totalTaken || 0} Tests Taken
                            </Text>
                        </View>
                        {activeCategory === 'WEEKLY' && (
                            <View style={styles.activeDotWeekly} />
                        )}
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[
                            styles.categorySwitchBtn,
                            activeCategory === 'MONTHLY' && styles.categorySwitchBtnActiveMonthly
                        ]}
                        onPress={() => {
                            setActiveCategory('MONTHLY');
                            setSelectedPoint(null);
                        }}
                        activeOpacity={0.8}
                    >
                        <View style={[styles.catIconBox, activeCategory === 'MONTHLY' && styles.catIconBoxActiveMonthly]}>
                            <Text style={styles.catEmoji}>🏆</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={[styles.catBtnTitle, activeCategory === 'MONTHLY' && styles.catBtnTitleActiveMonthly]}>
                                Monthly Tests
                            </Text>
                            <Text style={styles.catBtnCount}>
                                {progressData?.monthly?.totalTaken || 0} Tests Taken
                            </Text>
                        </View>
                        {activeCategory === 'MONTHLY' && (
                            <View style={styles.activeDotMonthly} />
                        )}
                    </TouchableOpacity>
                </View>

                {/* 🌟 2. KPI SUMMARY CARDS 🌟 */}
                <View style={styles.kpiGrid}>
                    <View style={styles.kpiCard}>
                        <View style={[styles.kpiIconBox, { backgroundColor: 'rgba(52, 211, 153, 0.15)' }]}>
                            <Icon name="chart-line" size={18} color="#34d399" />
                        </View>
                        <Text style={styles.kpiValue}>
                            {currentCategoryData.averagePercentage ? `${currentCategoryData.averagePercentage}%` : '0%'}
                        </Text>
                        <Text style={styles.kpiLabel}>Average Score</Text>
                        <Text style={styles.kpiSubLabel}>
                            Mean: {currentCategoryData.averageScore || 0} pts
                        </Text>
                    </View>

                    <View style={styles.kpiCard}>
                        <View style={[styles.kpiIconBox, { backgroundColor: 'rgba(245, 158, 11, 0.15)' }]}>
                            <Icon name="trophy-award" size={18} color="#f59e0b" />
                        </View>
                        <Text style={[styles.kpiValue, { color: '#fbbf24' }]}>
                            {currentCategoryData.highestScore ? `${currentCategoryData.highestScore} pts` : '0 pts'}
                        </Text>
                        <Text style={styles.kpiLabel}>Highest Score</Text>
                        <Text style={styles.kpiSubLabel}>Personal best</Text>
                    </View>

                    <View style={styles.kpiCard}>
                        <View style={[styles.kpiIconBox, { backgroundColor: 'rgba(59, 130, 246, 0.15)' }]}>
                            <Icon name="file-document-check-outline" size={18} color="#60a5fa" />
                        </View>
                        <Text style={[styles.kpiValue, { color: '#93c5fd' }]}>
                            {currentCategoryData.totalTaken || 0}
                        </Text>
                        <Text style={styles.kpiLabel}>Completed</Text>
                        <Text style={styles.kpiSubLabel}>
                            {activeCategory === 'WEEKLY' ? 'Weekly tests' : 'Monthly tests'}
                        </Text>
                    </View>

                    <View style={styles.kpiCard}>
                        <View style={[styles.kpiIconBox, { backgroundColor: 'rgba(168, 85, 247, 0.15)' }]}>
                            <Icon name="check-decagram-outline" size={18} color="#c084fc" />
                        </View>
                        <Text style={[styles.kpiValue, { color: '#d8b4fe' }]}>
                            {currentCategoryData.passRate || 0}%
                        </Text>
                        <Text style={styles.kpiLabel}>Pass Rate</Text>
                        <Text style={styles.kpiSubLabel}>
                            {currentCategoryData.passCount || 0} Passed
                        </Text>
                    </View>
                </View>

                {/* 🌟 3. TYPE FILTER PILLS 🌟 */}
                <View style={styles.filterRow}>
                    <Text style={styles.filterTitle}>FILTER BY:</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterPillsScroll}>
                        {[
                            { key: 'ALL', label: 'All Formats' },
                            { key: 'MCQ', label: 'MCQ Only' },
                            { key: 'STRUCTURED', label: 'Structured' },
                            { key: 'BOTH', label: 'Combined Both' }
                        ].map(f => {
                            const isSelected = typeFilter === f.key;
                            return (
                                <TouchableOpacity
                                    key={f.key}
                                    style={[
                                        styles.filterPill,
                                        isSelected && (activeCategory === 'WEEKLY' ? styles.filterPillActiveWeekly : styles.filterPillActiveMonthly)
                                    ]}
                                    onPress={() => {
                                        setTypeFilter(f.key);
                                        setSelectedPoint(null);
                                    }}
                                    activeOpacity={0.7}
                                >
                                    <Text style={[
                                        styles.filterPillText,
                                        isSelected && styles.filterPillTextActive
                                    ]}>
                                        {f.label}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </ScrollView>
                </View>

                {/* 🌟 4. VISUAL PROGRESS CHART 🌟 */}
                <View style={styles.chartCard}>
                    <View style={styles.chartHeader}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <Icon name="trending-up" size={18} color={activeCategory === 'WEEKLY' ? '#fbbf24' : '#818cf8'} />
                            <Text style={styles.chartTitle}>Score Progression Over Time</Text>
                        </View>
                        <Text style={styles.chartSubtitle}>
                            {activeCategory === 'WEEKLY' ? 'Weekly Performance Trend' : 'Monthly Performance Trend'}
                        </Text>
                    </View>

                    {categoryChartData.length === 0 ? (
                        <View style={styles.chartEmpty}>
                            <Icon name="chart-bell-curve" size={36} color="#475569" style={{ marginBottom: 8 }} />
                            <Text style={styles.chartEmptyText}>No test records available for this filter.</Text>
                            <Text style={styles.chartEmptySub}>Complete tests to view your score trend graph.</Text>
                        </View>
                    ) : (
                        <View style={styles.chartBody}>
                            {/* Selected Point Tooltip */}
                            {selectedPoint && (
                                <View style={styles.pointTooltip}>
                                    <View style={styles.tooltipRow}>
                                        <Text style={styles.tooltipTitle} numberOfLines={1}>{selectedPoint.testTitle}</Text>
                                        <Text style={styles.tooltipDate}>{formatDate(selectedPoint.submittedAt)}</Text>
                                    </View>
                                    <View style={styles.tooltipStatsRow}>
                                        <Text style={styles.tooltipScore}>Score: {selectedPoint.score} pts ({selectedPoint.percentage}%)</Text>
                                        <Text style={styles.tooltipRank}>Rank #{selectedPoint.rank} of {selectedPoint.totalParticipants}</Text>
                                    </View>
                                </View>
                            )}

                            {/* Responsive Bar Chart */}
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.barsContainer}>
                                {categoryChartData.map((pt, idx) => {
                                    const pct = Math.max(8, Math.min(100, pt.percentage || 0));
                                    const isPassed = pct >= 40;
                                    const isSelected = selectedPoint?.id === pt.id;

                                    return (
                                        <TouchableOpacity
                                            key={pt.id || idx}
                                            style={styles.barColumn}
                                            onPress={() => setSelectedPoint(pt)}
                                            activeOpacity={0.8}
                                        >
                                            <Text style={[styles.barScoreLabel, isSelected && { color: '#fbbf24', fontWeight: '900' }]}>
                                                {pt.score}
                                            </Text>
                                            <View style={styles.barTrack}>
                                                <View style={[
                                                    styles.barFill,
                                                    { height: `${pct}%` },
                                                    isSelected ? styles.barFillSelected :
                                                    activeCategory === 'WEEKLY'
                                                        ? (isPassed ? styles.barFillWeeklyPass : styles.barFillWeeklyFail)
                                                        : (isPassed ? styles.barFillMonthlyPass : styles.barFillMonthlyFail)
                                                ]} />
                                            </View>
                                            <Text style={styles.barDateLabel} numberOfLines={1}>
                                                {formatDate(pt.submittedAt)}
                                            </Text>
                                            <View style={[
                                                styles.barTypeDot,
                                                pt.paperType === 'MCQ' ? { backgroundColor: '#34d399' } :
                                                pt.paperType === 'STRUCTURED' ? { backgroundColor: '#c084fc' } :
                                                { backgroundColor: '#60a5fa' }
                                            ]} />
                                        </TouchableOpacity>
                                    );
                                })}
                            </ScrollView>

                            {/* Chart Legend */}
                            <View style={styles.chartLegend}>
                                <View style={styles.legendItem}>
                                    <View style={[styles.legendDot, { backgroundColor: '#34d399' }]} />
                                    <Text style={styles.legendText}>MCQ</Text>
                                </View>
                                <View style={styles.legendItem}>
                                    <View style={[styles.legendDot, { backgroundColor: '#c084fc' }]} />
                                    <Text style={styles.legendText}>Structured</Text>
                                </View>
                                <View style={styles.legendItem}>
                                    <View style={[styles.legendDot, { backgroundColor: '#60a5fa' }]} />
                                    <Text style={styles.legendText}>Both (MCQ+Essay)</Text>
                                </View>
                            </View>
                        </View>
                    )}
                </View>

                {/* 🌟 5. EXAM HISTORY LIST 🌟 */}
                <View style={styles.historySection}>
                    <View style={styles.historyHeader}>
                        <Text style={styles.historyTitle}>
                            {activeCategory === 'WEEKLY' ? '⚡ Weekly Exam Records' : '🏆 Monthly Exam Records'}
                        </Text>
                        <Text style={styles.historyCount}>
                            Showing {filteredHistory.length} exams
                        </Text>
                    </View>

                    {filteredHistory.length === 0 ? (
                        <View style={styles.historyEmpty}>
                            <Icon name="clipboard-text-outline" size={32} color="#475569" style={{ marginBottom: 8 }} />
                            <Text style={styles.historyEmptyText}>No exams found in this category.</Text>
                        </View>
                    ) : (
                        filteredHistory.map((item, idx) => {
                            const isPassed = item.isPassed;
                            const isBoth = item.paperType === 'BOTH';

                            return (
                                <View key={item.id || idx} style={styles.historyCard}>
                                    <View style={styles.historyCardTop}>
                                        <View style={{ flex: 1, paddingRight: 10 }}>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                                                <View style={[
                                                    styles.historyFormatBadge,
                                                    item.paperType === 'MCQ' ? styles.formatBadgeMcq :
                                                    item.paperType === 'STRUCTURED' ? styles.formatBadgeStruct :
                                                    styles.formatBadgeBoth
                                                ]}>
                                                    <Text style={styles.formatBadgeText}>
                                                        {item.paperType === 'MCQ' ? 'MCQ ONLY' : item.paperType === 'STRUCTURED' ? 'STRUCTURED' : 'MCQ + ESSAY'}
                                                    </Text>
                                                </View>
                                                <Text style={styles.historyDateText}>
                                                    {formatDate(item.submittedAt)}
                                                </Text>
                                            </View>
                                            <Text style={styles.historyTestTitle} numberOfLines={2}>
                                                {item.testTitle}
                                            </Text>
                                        </View>

                                        {/* Score Badge */}
                                        <View style={[styles.scorePill, isPassed ? styles.scorePillPass : styles.scorePillFail]}>
                                            <Text style={styles.scorePillVal}>{item.score} pts</Text>
                                            <Text style={styles.scorePillPct}>{item.percentage}%</Text>
                                        </View>
                                    </View>

                                    {/* Breakdown & Rank Row */}
                                    <View style={styles.historyCardBottom}>
                                        <View style={styles.rankInfoBox}>
                                            <Icon name="medal" size={15} color="#f59e0b" />
                                            <Text style={styles.rankInfoText}>
                                                Rank #{item.rank} of {item.totalParticipants} Candidates
                                            </Text>
                                        </View>

                                        {isBoth && (
                                            <View style={styles.marksBreakdownRow}>
                                                <Text style={styles.breakdownMcq}>MCQ: {item.mcqScore} pts</Text>
                                                <Text style={styles.breakdownDivider}>|</Text>
                                                <Text style={styles.breakdownStruct}>Essay: {item.structuredScore} pts</Text>
                                            </View>
                                        )}
                                    </View>
                                </View>
                            );
                        })
                    )}
                </View>
            </ScrollView>
        </View>
    );
};

export default StudentProgressScreen;

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0a0f1d'
    },
    centerContainer: {
        flex: 1,
        backgroundColor: '#0a0f1d',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20
    },
    loadingText: {
        color: '#94a3b8',
        marginTop: 12,
        fontSize: 14,
        fontWeight: '600'
    },

    // Header
    header: {
        height: 60,
        backgroundColor: 'rgba(15, 23, 42, 0.95)',
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255, 255, 255, 0.1)',
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        gap: 12
    },
    backBtn: {
        width: 36,
        height: 36,
        borderRadius: 10,
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)'
    },
    headerLogo: {
        width: 34,
        height: 34
    },
    headerTitleWrap: {
        flex: 1
    },
    headerTitle: {
        color: '#ffffff',
        fontSize: 15,
        fontWeight: '800'
    },
    headerSubTitle: {
        color: '#94a3b8',
        fontSize: 11,
        fontWeight: '600'
    },
    refreshBtn: {
        width: 36,
        height: 36,
        borderRadius: 10,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)'
    },

    scrollContent: {
        padding: 16,
        paddingBottom: 40
    },

    // Category Switcher
    categorySwitchContainer: {
        flexDirection: 'row',
        gap: 10,
        marginBottom: 16
    },
    categorySwitchBtn: {
        flex: 1,
        backgroundColor: 'rgba(15, 23, 42, 0.6)',
        borderWidth: 1.5,
        borderColor: 'rgba(255, 255, 255, 0.1)',
        borderRadius: 16,
        padding: 12,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        position: 'relative'
    },
    categorySwitchBtnActiveWeekly: {
        backgroundColor: 'rgba(245, 158, 11, 0.12)',
        borderColor: '#f59e0b'
    },
    categorySwitchBtnActiveMonthly: {
        backgroundColor: 'rgba(99, 102, 241, 0.12)',
        borderColor: '#6366f1'
    },
    catIconBox: {
        width: 38,
        height: 38,
        borderRadius: 10,
        backgroundColor: 'rgba(255, 255, 255, 0.06)',
        alignItems: 'center',
        justifyContent: 'center'
    },
    catIconBoxActiveWeekly: {
        backgroundColor: '#f59e0b'
    },
    catIconBoxActiveMonthly: {
        backgroundColor: '#6366f1'
    },
    catEmoji: {
        fontSize: 18
    },
    catBtnTitle: {
        color: '#94a3b8',
        fontSize: 13,
        fontWeight: '800'
    },
    catBtnTitleActiveWeekly: {
        color: '#ffffff'
    },
    catBtnTitleActiveMonthly: {
        color: '#ffffff'
    },
    catBtnCount: {
        color: '#64748b',
        fontSize: 10,
        fontWeight: '600',
        marginTop: 1
    },
    activeDotWeekly: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#f59e0b',
        position: 'absolute',
        top: 10,
        right: 10
    },
    activeDotMonthly: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#6366f1',
        position: 'absolute',
        top: 10,
        right: 10
    },

    // KPI Grid
    kpiGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
        marginBottom: 16
    },
    kpiCard: {
        flex: 1,
        minWidth: (width - 42) / 2,
        backgroundColor: 'rgba(15, 23, 42, 0.6)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
        borderRadius: 16,
        padding: 14
    },
    kpiIconBox: {
        width: 32,
        height: 32,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 8
    },
    kpiValue: {
        color: '#34d399',
        fontSize: 20,
        fontWeight: '900'
    },
    kpiLabel: {
        color: '#e2e8f0',
        fontSize: 12,
        fontWeight: '800',
        marginTop: 2
    },
    kpiSubLabel: {
        color: '#64748b',
        fontSize: 10,
        fontWeight: '600',
        marginTop: 1
    },

    // Filter Row
    filterRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginBottom: 16
    },
    filterTitle: {
        color: '#64748b',
        fontSize: 10,
        fontWeight: '900',
        letterSpacing: 0.5
    },
    filterPillsScroll: {
        gap: 8,
        paddingRight: 10
    },
    filterPill: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)'
    },
    filterPillActiveWeekly: {
        backgroundColor: 'rgba(245, 158, 11, 0.2)',
        borderColor: '#f59e0b'
    },
    filterPillActiveMonthly: {
        backgroundColor: 'rgba(99, 102, 241, 0.2)',
        borderColor: '#6366f1'
    },
    filterPillText: {
        color: '#94a3b8',
        fontSize: 11,
        fontWeight: '700'
    },
    filterPillTextActive: {
        color: '#ffffff',
        fontWeight: '900'
    },

    // Chart Card
    chartCard: {
        backgroundColor: 'rgba(15, 23, 42, 0.7)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
        borderRadius: 20,
        padding: 16,
        marginBottom: 20
    },
    chartHeader: {
        marginBottom: 14
    },
    chartTitle: {
        color: '#ffffff',
        fontSize: 14,
        fontWeight: '800'
    },
    chartSubtitle: {
        color: '#64748b',
        fontSize: 11,
        fontWeight: '600',
        marginTop: 2
    },
    chartEmpty: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 36
    },
    chartEmptyText: {
        color: '#94a3b8',
        fontSize: 13,
        fontWeight: '700'
    },
    chartEmptySub: {
        color: '#475569',
        fontSize: 11,
        marginTop: 2
    },
    chartBody: {
        paddingTop: 8
    },

    // Tooltip
    pointTooltip: {
        backgroundColor: '#1e293b',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.15)',
        borderRadius: 12,
        padding: 10,
        marginBottom: 12
    },
    tooltipRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4
    },
    tooltipTitle: {
        color: '#ffffff',
        fontSize: 12,
        fontWeight: '800',
        flex: 1,
        paddingRight: 8
    },
    tooltipDate: {
        color: '#94a3b8',
        fontSize: 10,
        fontWeight: '600'
    },
    tooltipStatsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center'
    },
    tooltipScore: {
        color: '#34d399',
        fontSize: 11,
        fontWeight: '800'
    },
    tooltipRank: {
        color: '#fbbf24',
        fontSize: 11,
        fontWeight: '800'
    },

    // Bars
    barsContainer: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        gap: 16,
        paddingVertical: 12,
        minHeight: 160
    },
    barColumn: {
        alignItems: 'center',
        width: 44
    },
    barScoreLabel: {
        color: '#94a3b8',
        fontSize: 10,
        fontWeight: '700',
        marginBottom: 6
    },
    barTrack: {
        width: 14,
        height: 100,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderRadius: 7,
        justifyContent: 'flex-end',
        overflow: 'hidden'
    },
    barFill: {
        width: '100%',
        borderRadius: 7
    },
    barFillSelected: {
        backgroundColor: '#fbbf24'
    },
    barFillWeeklyPass: {
        backgroundColor: '#f59e0b'
    },
    barFillWeeklyFail: {
        backgroundColor: '#ef4444'
    },
    barFillMonthlyPass: {
        backgroundColor: '#6366f1'
    },
    barFillMonthlyFail: {
        backgroundColor: '#ef4444'
    },
    barDateLabel: {
        color: '#64748b',
        fontSize: 9,
        fontWeight: '600',
        marginTop: 6
    },
    barTypeDot: {
        width: 5,
        height: 5,
        borderRadius: 2.5,
        marginTop: 4
    },

    // Chart Legend
    chartLegend: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 16,
        marginTop: 14,
        paddingTop: 10,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255, 255, 255, 0.06)'
    },
    legendItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6
    },
    legendDot: {
        width: 8,
        height: 8,
        borderRadius: 4
    },
    legendText: {
        color: '#94a3b8',
        fontSize: 10,
        fontWeight: '600'
    },

    // History Section
    historySection: {
        marginBottom: 20
    },
    historyHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12
    },
    historyTitle: {
        color: '#ffffff',
        fontSize: 14,
        fontWeight: '800'
    },
    historyCount: {
        color: '#64748b',
        fontSize: 11,
        fontWeight: '600'
    },
    historyEmpty: {
        backgroundColor: 'rgba(15, 23, 42, 0.4)',
        borderRadius: 16,
        padding: 30,
        alignItems: 'center'
    },
    historyEmptyText: {
        color: '#64748b',
        fontSize: 12,
        fontWeight: '600'
    },
    historyCard: {
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
        borderRadius: 16,
        padding: 14,
        marginBottom: 10
    },
    historyCardTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start'
    },
    historyFormatBadge: {
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 5
    },
    formatBadgeMcq: {
        backgroundColor: 'rgba(52, 211, 153, 0.15)'
    },
    formatBadgeStruct: {
        backgroundColor: 'rgba(192, 132, 252, 0.15)'
    },
    formatBadgeBoth: {
        backgroundColor: 'rgba(96, 165, 250, 0.15)'
    },
    formatBadgeText: {
        fontSize: 9,
        fontWeight: '800',
        color: '#ffffff'
    },
    historyDateText: {
        color: '#64748b',
        fontSize: 10,
        fontWeight: '600'
    },
    historyTestTitle: {
        color: '#ffffff',
        fontSize: 13,
        fontWeight: '800',
        lineHeight: 18
    },
    scorePill: {
        alignItems: 'flex-end',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 10
    },
    scorePillPass: {
        backgroundColor: 'rgba(52, 211, 153, 0.12)',
        borderWidth: 1,
        borderColor: 'rgba(52, 211, 153, 0.3)'
    },
    scorePillFail: {
        backgroundColor: 'rgba(239, 68, 68, 0.12)',
        borderWidth: 1,
        borderColor: 'rgba(239, 68, 68, 0.3)'
    },
    scorePillVal: {
        color: '#34d399',
        fontSize: 14,
        fontWeight: '900'
    },
    scorePillPct: {
        color: '#94a3b8',
        fontSize: 10,
        fontWeight: '700'
    },
    historyCardBottom: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 10,
        paddingTop: 8,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255, 255, 255, 0.05)'
    },
    rankInfoBox: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5
    },
    rankInfoText: {
        color: '#f59e0b',
        fontSize: 11,
        fontWeight: '700'
    },
    marksBreakdownRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6
    },
    breakdownMcq: {
        color: '#34d399',
        fontSize: 10,
        fontWeight: '700'
    },
    breakdownDivider: {
        color: '#475569',
        fontSize: 10
    },
    breakdownStruct: {
        color: '#c084fc',
        fontSize: 10,
        fontWeight: '700'
    }
});
