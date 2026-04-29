"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import ReceivedCardItem from "@/components/received-cards/ReceivedCardItem";
import CardDetailModal from "@/components/received-cards/CardDetailModal";
import { Grid, List, Loader2, Plus, Mail, MapPin } from "lucide-react";

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
  const [selectedCard, setSelectedCard] = useState<ReceivedCard | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 0,
  });

  // 加载收信列表（开源版：无需登录检查）
  const loadCards = async (page = 1) => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/received-cards?page=${page}&pageSize=${pagination.pageSize}`,
      );

      console.log('[ReceivedHistory] Response status:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log('[ReceivedHistory] Response data:', data);
        setCards(data.data || []);
        setPagination(data.pagination || pagination);
      }
    } catch (error) {
      console.error('Failed to load cards:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCards();
  }, []);

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
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
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
                      {
                        new Set(
                          cards.map((c) => c.senderCountry).filter(Boolean),
                        ).size
                      }
                    </span>{" "}
                    个国家/地区
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3">
              {/* 视图切换 */}
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
              {/* 列表视图 */}
              <div
                className={
                  viewMode === "grid"
                    ? "grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4"
                    : "space-y-4"
                }
              >
                {cards.map((card) => (
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
                    onClick={() => loadCards(pagination.page - 1)}
                    disabled={pagination.page <= 1}
                    className="px-4 py-2 bg-white rounded-xl shadow-md border border-slate-200 text-gray-700 hover:bg-white hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    上一页
                  </button>
                  <span className="text-gray-600 px-4">
                    {pagination.page} / {pagination.totalPages}
                  </span>
                  <button
                    onClick={() => loadCards(pagination.page + 1)}
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
        </div>
      </main>

      <Footer />
    </div>
  );
}
