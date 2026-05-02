"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import ReceivedCardItem from "@/components/received-cards/ReceivedCardItem";
import CardDetailModal from "@/components/received-cards/CardDetailModal";
import { WordCloudContainer } from "@/components/arrivals/WordCloudContainer";
import { HighlightsContainer } from "@/components/arrivals/HighlightsContainer";
import { Grid, List, Loader2, Plus, Mail, MapPin, BookOpen, Cloud, Star, Filter } from "lucide-react";

type TabKey = "collection" | "wordcloud" | "highlights";

const TABS: { key: TabKey; label: string; icon: typeof Mail }[] = [
  { key: "collection", label: "卡册", icon: BookOpen },
  { key: "wordcloud", label: "词云", icon: Cloud },
  { key: "highlights", label: "精选", icon: Star },
];

interface ReceivedCard {
  id: string;
  postcardId?: string | null;
  senderUsername: string | null;
  senderCountry: string | null;
  senderCity: string | null;
  handwrittenText: string | null;
  translatedText: string | null;
  detectedLang: string | null;
  backImageUrl: string | null;
  originalImageUrl: string | null;
  processedImageUrl: string | null;
  imageProcessingStatus?: string | null;
  frontImageUrl: string | null;
  shareImageUrl: string | null;
  isPublic: boolean;
  receivedAt: string | null;
  createdAt: string;
  // 稀有度字段（来自 UserGachaLog）
  rarity?: "SSR" | "SR" | "R" | "N" | null;
  luckyLevel?: "none" | "lucky" | "special" | "superLucky" | null;
}

export default function ReceivedCardsPage() {
  const router = useRouter();
  const { token, isLoading } = useAuth();

  const [cards, setCards] = useState<ReceivedCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [activeTab, setActiveTab] = useState<TabKey>("collection");
  const [rarityFilter, setRarityFilter] = useState<string | null>(null);
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [byCountry, setByCountry] = useState<{ country: string; count: number }[]>([]);
  const [byRarity, setByRarity] = useState<Record<string, number>>({});
  const [selectedCard, setSelectedCard] = useState<ReceivedCard | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 0,
  });

  // 加载收信列表（开源版：无需登录检查）
  const loadCards = async (page = 1, country?: string | null, rarity?: string | null) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pagination.pageSize),
      });
      if (country) params.set('country', country);
      if (rarity) params.set('rarity', rarity);

      const response = await fetch(`/api/received-cards?${params}`);

      if (response.ok) {
        const data = await response.json();
        setCards(data.data || []);
        setPagination(data.pagination || pagination);
        if (data.byCountry) setByCountry(data.byCountry);
        if (data.byRarity) setByRarity(data.byRarity);
      }
    } catch (error) {
      console.error('Failed to load cards:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCards(1, selectedCountry, rarityFilter);
  }, [selectedCountry, rarityFilter]);

  // 处理卡片点击
  const handleCardClick = (card: ReceivedCard) => {
    setSelectedCard(card);
    setModalOpen(true);
  };

  // 处理删除
  const handleDeleteCard = async (cardId: string) => {
    if (!token) return;
    if (!confirm("确定要删除这张明信片吗？此操作不可恢复。")) return;

    try {
      const response = await fetch(`/api/received-cards/${cardId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        // 从列表中移除
        setCards((prev) => prev.filter((card) => card.id !== cardId));
        // 更新分页总数
        setPagination((prev) => ({
          ...prev,
          total: prev.total - 1,
        }));
        alert("删除成功");
      } else {
        throw new Error("删除失败");
      }
    } catch (error) {
      // console.error('Failed to delete card:', error);
      alert("删除失败，请重试");
    }
  };

  // 加载中时显示 loading（开源版：无需登录检查）
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-orange-50/30 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-orange-50/30 relative overflow-hidden">
      <Header />


      <main className="py-12 px-4">
        <div className="max-w-6xl mx-auto relative z-10">
          {/* Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">收信墙</h1>
              <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
                <span className="flex items-center gap-1.5">
                  <Mail className="w-4 h-4 text-blue-600" />
                  共收到{" "}
                  <span className="font-bold text-gray-900">
                    {pagination.total}
                  </span>{" "}
                  张明信片
                </span>
                {pagination.total > 0 && (
                  <span className="flex items-center gap-1.5">
                    <MapPin className="w-4 h-4 text-purple-600" />
                    来自{" "}
                    <span className="font-bold text-gray-900">
                      {byCountry.length}
                    </span>{" "}
                    个国家/地区
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3">
              {/* 视图切换（仅卡册 tab） */}
              {activeTab === "collection" && (
                <div className="flex bg-white rounded-xl p-1.5 shadow-md border border-slate-200">
                  <button
                    onClick={() => setViewMode("grid")}
                    className={`p-2.5 rounded-lg transition-all duration-200 ${
                      viewMode === "grid"
                        ? "bg-gradient-to-br from-orange-500 to-amber-500 text-white shadow-md"
                        : "text-gray-500 hover:text-gray-700 hover:bg-gray-100"
                    }`}
                    title="网格视图"
                  >
                    <Grid className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => setViewMode("list")}
                    className={`p-2.5 rounded-lg transition-all duration-200 ${
                      viewMode === "list"
                        ? "bg-gradient-to-br from-orange-500 to-amber-500 text-white shadow-md"
                        : "text-gray-500 hover:text-gray-700 hover:bg-gray-100"
                    }`}
                    title="列表视图"
                  >
                    <List className="w-5 h-5" />
                  </button>
                </div>
              )}

              {/* 上传按钮 */}
              <button
                onClick={() => router.push("/received/upload")}
                className="px-6 py-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl font-medium hover:from-orange-600 hover:to-amber-600 transition-all flex items-center gap-2 shadow-lg shadow-orange-500/25 hover:shadow-xl hover:-translate-y-0.5"
              >
                <Plus className="w-5 h-5" />
                上传新明信片
              </button>
            </div>
          </div>

          {/* TabBar */}
          <div className="sticky top-16 z-10 border-b border-slate-100 bg-white/90 backdrop-blur-xl -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 mb-6">
            <div className="flex gap-2 py-3">
              {TABS.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={`relative flex flex-1 items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-medium transition-all duration-300 ${
                      isActive
                        ? "bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-lg shadow-orange-500/20"
                        : "bg-white/70 text-slate-500 hover:bg-slate-50 hover:text-slate-700"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Tab 内容 */}
          {activeTab === "wordcloud" ? (
            <WordCloudContainer source="received" />
          ) : activeTab === "highlights" ? (
            <HighlightsContainer source="received" showHeader={true} />
          ) : (
          <>
          {/* 明信片列表 */}
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
          ) : cards.length === 0 ? (
            // 空状态
            <div className="bg-white border border-slate-200 rounded-2xl shadow-lg p-12 text-center hover:shadow-xl transition-all duration-300">
              <div className="text-6xl mb-4">🏺️</div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                还没有收到明信片
              </h2>
              <p className="text-gray-600 mb-6">
                上传你第 1 张收到的明信片，开始记录你的收信之旅
              </p>
              <button
                onClick={() => router.push("/received/upload")}
                className="px-8 py-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl font-medium hover:from-orange-600 hover:to-amber-600 transition-all inline-flex items-center gap-2 shadow-lg shadow-orange-500/25 hover:shadow-xl hover:-translate-y-0.5"
              >
                <Plus className="w-5 h-5" />
                上传明信片
              </button>
            </div>
          ) : (
            <>
              {/* 国家筛选 */}
              {byCountry.length > 1 && (
                <div className="mb-4 overflow-x-auto pb-1">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    <button
                      onClick={() => setSelectedCountry(null)}
                      className={`flex-shrink-0 rounded-full px-3.5 py-1.5 text-xs font-medium transition-all duration-200 ${
                        !selectedCountry
                          ? "bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-md shadow-orange-500/25"
                          : "bg-white text-slate-600 border border-slate-200 hover:border-orange-300 hover:text-orange-600"
                      }`}
                    >
                      全部
                      <span className={`ml-1 ${!selectedCountry ? "text-white/80" : "text-slate-400"}`}>
                        ({pagination.total})
                      </span>
                    </button>
                    {byCountry.map((c) => (
                      <button
                        key={c.country}
                        onClick={() => setSelectedCountry(c.country)}
                        className={`flex-shrink-0 rounded-full px-3.5 py-1.5 text-xs font-medium transition-all duration-200 ${
                          selectedCountry === c.country
                            ? "bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-md shadow-orange-500/25"
                            : "bg-white text-slate-600 border border-slate-200 hover:border-orange-300 hover:text-orange-600"
                        }`}
                      >
                        {c.country}
                        <span className={`ml-1 ${selectedCountry === c.country ? "text-white/80" : "text-slate-400"}`}>
                          ({c.count})
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* 稀有度筛选 */}
              <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-1">
                <Filter className="w-4 h-4 text-slate-400 flex-shrink-0" />
                {[null, "SSR", "SR", "R", "N"].map((r) => {
                  const isActive = rarityFilter === r;
                  const label = r || "全部";
                  const count = r
                    ? (byRarity[r] || 0)
                    : pagination.total;
                  return (
                    <button
                      key={label}
                      onClick={() => setRarityFilter(r)}
                      className={`flex-shrink-0 rounded-full px-3.5 py-1.5 text-xs font-medium transition-all duration-200 ${
                        isActive
                          ? "bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-md shadow-orange-500/25"
                          : "bg-white text-slate-600 border border-slate-200 hover:border-orange-300 hover:text-orange-600"
                      }`}
                    >
                      {label}
                      <span className={`ml-1 ${isActive ? "text-white/80" : "text-slate-400"}`}>
                        ({count})
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* 列表视图 */}
              <div
                className={
                  viewMode === "grid"
                    ? "grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4"
                    : "space-y-4"
                }
              >
                {cards
                  .map((card) => (
                    <ReceivedCardItem
                      key={card.id}
                      card={card}
                      viewMode={viewMode}
                      onClick={() => handleCardClick(card)}
                    />
                  ))}
              </div>

              {/* 分页 */}
              {pagination.totalPages > 1 && (
                <div className="flex justify-center items-center gap-2 mt-8">
                  <button
                    onClick={() => loadCards(pagination.page - 1, selectedCountry, rarityFilter)}
                    disabled={pagination.page <= 1}
                    className="px-4 py-2 bg-white rounded-xl shadow-md border border-slate-200 text-gray-700 hover:bg-white hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    上一页
                  </button>
                  <span className="text-gray-600 px-4">
                    {pagination.page} / {pagination.totalPages}
                  </span>
                  <button
                    onClick={() => loadCards(pagination.page + 1, selectedCountry, rarityFilter)}
                    disabled={pagination.page >= pagination.totalPages}
                    className="px-4 py-2 bg-white rounded-xl shadow-md border border-slate-200 text-gray-700 hover:bg-white hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    下一页
                  </button>
                </div>
              )}
            </>
          )}

          {/* 明信片详情弹窗 */}
          <CardDetailModal
            card={selectedCard}
            open={modalOpen}
            onOpenChange={setModalOpen}
            onDelete={handleDeleteCard}
          />
          </>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
