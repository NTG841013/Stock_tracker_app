'use client';

import { useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { deleteAlert } from '@/lib/actions/alert.actions';
import { toast } from 'sonner';
import AlertModal from './AlertModal';
import { formatPrice } from '@/lib/utils';

interface AlertsListProps {
    alertData: any[];
    watchlistData: StockWithData[];
}

export default function AlertsList({ alertData, watchlistData }: AlertsListProps) {
    const [alerts, setAlerts] = useState(alertData || []);
    const [editingAlert, setEditingAlert] = useState<any | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    const handleDelete = async (alertId: string, symbol: string) => {
        const result = await deleteAlert(alertId);
        if (result.ok) {
            setAlerts(alerts.filter(a => a.id !== alertId));
            toast.success(`Alert for ${symbol} removed`);
        } else {
            toast.error(result.error || 'Failed to delete alert');
        }
    };

    const handleEdit = (alert: any) => {
        setEditingAlert(alert);
        setIsModalOpen(true);
    };

    const formatCondition = (condition: string) => {
        return condition === 'greater' ? '>' : '<';
    };

    {/*  const formatVolume = (vol: number): string => {
        if (vol >= 1_000_000_000) return `${(vol / 1_000_000_000).toFixed(2)}B`;
        if (vol >= 1_000_000) return `${(vol / 1_000_000).toFixed(2)}M`;
        if (vol >= 1_000) return `${(vol / 1_000).toFixed(2)}K`;
        return vol.toString();
    };*/}

    const getChangePercent = (symbol: string) => {
        const stock = watchlistData.find(s => s.symbol === symbol);
        return stock?.changePercent || 0;
    };

    const formatChangePercent = (changePercent: number) => {
        const sign = changePercent >= 0 ? '+' : '';
        return `${sign}${changePercent.toFixed(2)}%`;
    };

    const getChangeColor = (changePercent: number) => {
        return changePercent >= 0 ? 'text-green-500' : 'text-red-500';
    };

    const formatAlertDate = (date: Date | string) => {
        const d = new Date(date);
        return d.toISOString().split('T')[0];
    };

    return (
        <>
            <div className="alert-list h-full">
                {alerts.length === 0 ? (
                    <div className="alert-empty">
                        No alerts yet. Add an alert from the watchlist.
                    </div>
                ) : (
                    alerts.map((alert) => {
                        const changePercent = getChangePercent(alert.symbol);
                        return (
                            <div key={alert.id} className="alert-item">
                                <div className="flex items-start justify-between mb-3">
                                    <h3 className="alert-name flex-1">{alert.alertName}</h3>
                                    <div className="text-right ml-4">
                                        <div className="text-base font-semibold text-gray-100">{alert.symbol}</div>
                                        <div className={`text-sm font-semibold ${getChangeColor(changePercent)}`}>
                                            {formatChangePercent(changePercent)}
                                        </div>
                                    </div>
                                </div>

                                <div className="alert-details mb-3">
                                    <div>
                                        <p className="alert-company">{alert.company}</p>
                                        <p className="alert-price">{formatPrice(alert.currentPrice)}</p>
                                    </div>
                                </div>

                                <div className="text-sm mb-3">
                                    <span className="text-gray-400">Alert at:</span>
                                    <div className="text-green-500 font-semibold mt-1">
                                        {alert.alertType === 'price' ? (
                                            <>Price {formatCondition(alert.condition)} {formatPrice(alert.threshold)}</>
                                        ) : (
                                            <>Volume {formatCondition(alert.condition)} {formatVolume(alert.threshold)} shares</>
                                        )}
                                    </div>
                                </div>

                                <div className="alert-actions">
                                    <div className="text-xs text-gray-500">
                                        {formatAlertDate(alert.createdAt)}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => handleEdit(alert)}
                                            className="alert-update-btn"
                                            title="Edit alert"
                                        >
                                            <Pencil className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(alert.id, alert.symbol)}
                                            className="alert-delete-btn"
                                            title="Delete alert"
                                        >
                                            <Trash2 className="trash-icon" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {isModalOpen && (
                <AlertModal
                    open={isModalOpen}
                    setOpen={setIsModalOpen}
                    alertId={editingAlert?.id}
                    alertData={{
                        symbol: editingAlert.symbol,
                        company: editingAlert.company,
                        alertName: editingAlert.alertName,
                        alertType: editingAlert.alertType,
                        condition: editingAlert.condition,
                        threshold: String(editingAlert.threshold)
                    }}
                    action="edit"
                />
            )}
        </>
    );
}