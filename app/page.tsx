"use client";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "../lib/supabase";

export default function PatientPage() {
  const [currentCalled, setCurrentCalled] = useState(null);
  const [waitingCount, setWaitingCount] = useState(0);
  const [myNumber, setMyNumber] = useState(null);
  const [myStatus, setMyStatus] = useState(null);
  const [waitingAhead, setWaitingAhead] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const today = new Date().toISOString().slice(0, 10);

  // --- データ取得 ---
  const fetchQueue = useCallback(async () => {
    // 現在呼び出し中
    const { data: calledData } = await supabase
      .from("queue")
      .select("number")
      .eq("visit_date", today)
      .eq("status", "called")
      .limit(1)
      .maybeSingle();

    setCurrentCalled(calledData?.number ?? null);

    // 待ち人数
    const { count } = await supabase
      .from("queue")
      .select("*", { count: "exact", head: true })
      .eq("visit_date", today)
      .eq("status", "waiting");

    setWaitingCount(count ?? 0);

    // 自分のチケット状態を更新
    if (myNumber) {
      const { data: myData } = await supabase
        .from("queue")
        .select("status")
        .eq("visit_date", today)
        .eq("number", myNumber)
        .maybeSingle();

      if (myData) {
        setMyStatus(myData.status);
      }

      // 自分より前の待ち人数
      const { count: ahead } = await supabase
        .from("queue")
        .select("*", { count: "exact", head: true })
        .eq("visit_date", today)
        .eq("status", "waiting")
        .lt("number", myNumber);

      setWaitingAhead(ahead ?? 0);
    }
  }, [today, myNumber]);

  // 初回読み込み
  useEffect(() => {
    fetchQueue();
  }, [fetchQueue]);

  // リアルタイム更新
  useEffect(() => {
    const channel = supabase
      .channel("queue-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "queue" },
        () => {
          fetchQueue();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchQueue]);

  // ローカルストレージから自分の番号を復元
  useEffect(() => {
    const saved = localStorage.getItem("my-ticket-" + today);
    if (saved) {
      setMyNumber(parseInt(saved));
    }
  }, [today]);

  // --- 整理券取得 ---
  const takeTicket = async () => {
    setLoading(true);
    setError(null);

    try {
      // 現在の最大番号を取得
      const { data: maxData } = await supabase
        .from("queue")
        .select("number")
        .eq("visit_date", today)
        .order("number", { ascending: false })
        .limit(1)
        .maybeSingle();

      const nextNumber = (maxData?.number ?? 0) + 1;

      const { data, error: insertError } = await supabase
        .from("queue")
        .insert({ number: nextNumber, visit_date: today, status: "waiting" })
        .select()
        .single();

      if (insertError) throw insertError;

      setMyNumber(data.number);
      setMyStatus("waiting");
      localStorage.setItem("my-ticket-" + today, data.number.toString());
      fetchQueue();
    } catch (err) {
      setError("取得に失敗しました。もう一度お試しください。");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // --- 表示 ---
  const isMyTurn = myStatus === "called";
  const isDone = myStatus === "done" || myStatus === "cancel" || myStatus === "skipped";

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center px-4 py-8">
      <div className="w-full max-w-md">
        {/* ヘッダー */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 bg-emerald-50 text-emerald-700 px-4 py-1.5 rounded-full text-sm font-semibold mb-3">
            <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
            受付中
          </div>
          <h1 className="text-2xl font-bold text-gray-900">順番待ちシステム</h1>
          <p className="text-sm text-gray-500 mt-1">
            {new Date().toLocaleDateString("ja-JP", {
              year: "numeric",
              month: "long",
              day: "numeric",
              weekday: "long",
            })}
          </p>
        </div>

        {/* 現在の診察番号 */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 text-center mb-5">
          <p className="text-xs font-semibold text-gray-400 tracking-widest uppercase mb-3">
            現在の診察番号
          </p>
          <p className="text-7xl font-extrabold text-emerald-600 leading-none tracking-tight">
            {currentCalled ?? "—"}
          </p>
          <p className="text-sm text-gray-500 mt-4">
            待ち人数: <span className="font-bold text-gray-900">{waitingCount}名</span>
          </p>
        </div>

        {/* 整理券取得 or 自分の番号 */}
        {!myNumber ? (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 text-center">
            <p className="text-sm text-gray-500 mb-5">
              整理券を取得して順番をお待ちください
            </p>
            <button
              onClick={takeTicket}
              disabled={loading}
              className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white text-lg font-bold rounded-xl transition disabled:opacity-50"
            >
              {loading ? "取得中..." : "整理券を取得する"}
            </button>
            {error && <p className="text-red-500 text-sm mt-3">{error}</p>}
          </div>
        ) : (
          <div
            className={`bg-white rounded-2xl border shadow-sm p-6 text-center ${
              isMyTurn ? "border-purple-400 border-2" : "border-gray-200"
            }`}
          >
            {/* 呼び出し中 */}
            {isMyTurn && (
              <div className="bg-purple-50 text-purple-700 px-4 py-3 rounded-xl font-bold mb-4 animate-pulse">
                🔔 お呼び出し中です！受付へお越しください
              </div>
            )}

            {/* 完了系 */}
            {isDone && (
              <div
                className={`px-4 py-3 rounded-xl font-semibold mb-4 ${
                  myStatus === "done"
                    ? "bg-green-50 text-green-700"
                    : "bg-red-50 text-red-600"
                }`}
              >
                {myStatus === "done" && "✓ 診察完了しました"}
                {myStatus === "cancel" && "キャンセルされました"}
                {myStatus === "skipped" && "スキップされました。受付にお声がけください"}
              </div>
            )}

            <p className="text-xs font-semibold text-gray-400 tracking-widest uppercase mb-2">
              あなたの番号
            </p>
            <p
              className={`text-6xl font-extrabold leading-none tracking-tight ${
                isMyTurn ? "text-purple-600" : "text-gray-900"
              }`}
            >
              {myNumber}
            </p>

            {/* 待ち人数 */}
            {myStatus === "waiting" && waitingAhead !== null && (
              <div className="mt-5 bg-gray-50 border border-gray-100 rounded-xl py-3 px-5">
                <span className="text-sm text-gray-500">あと </span>
                <span className="text-3xl font-bold text-emerald-600">{waitingAhead}</span>
                <span className="text-sm text-gray-500"> 人</span>
              </div>
            )}
          </div>
        )}

        {/* スタッフ画面リンク */}
        <div className="text-center mt-8">
          <a href="/staff" className="text-sm text-gray-400 hover:text-gray-600 underline">
            スタッフ画面はこちら
          </a>
        </div>
      </div>
    </div>
  );
}