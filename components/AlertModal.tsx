'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogHeader } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { createAlert, updateAlert } from '@/lib/actions/alert.actions';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

interface AlertModalProps {
    open: boolean;
    setOpen: (open: boolean) => void;
    alertId?: string;
    alertData?: {
        symbol: string;
        company: string;
        alertName: string;
        alertType: 'price' | 'volume';
        condition: 'greater' | 'less';
        threshold: string;
    };
    action?: 'create' | 'edit';
    currentPrice?: number;
}

export default function AlertModal({
                                       open,
                                       setOpen,
                                       alertId,
                                       alertData,
                                       action = 'create',
                                       currentPrice = 0
                                   }: AlertModalProps) {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        alertName: alertData?.alertName || `${alertData?.company || ''} Alert`,
        alertType: alertData?.alertType || 'price',
        condition: alertData?.condition || 'greater',
        threshold: alertData?.threshold || (
            alertData?.alertType === 'volume'
                ? '10000000'  // Default 10M shares for volume
                : currentPrice.toString()  // Current price for price alerts
        )
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            if (action === 'edit' && alertId) {
                const result = await updateAlert(alertId, {
                    alertName: formData.alertName,
                    alertType: formData.alertType as 'price' | 'volume',
                    condition: formData.condition as 'greater' | 'less',
                    threshold: parseFloat(formData.threshold)
                });

                if (result.ok) {
                    toast.success('Alert updated successfully');
                    router.refresh();
                    setOpen(false);
                } else {
                    toast.error(result.error || 'Failed to update alert');
                }
            } else {
                const result = await createAlert({
                    symbol: alertData!.symbol,
                    company: alertData!.company,
                    alertName: formData.alertName,
                    currentPrice: currentPrice,
                    alertType: formData.alertType as 'price' | 'volume',
                    condition: formData.condition as 'greater' | 'less',
                    threshold: parseFloat(formData.threshold)
                });

                if (result.ok) {
                    toast.success('Alert created successfully');
                    router.refresh();
                    setOpen(false);
                } else {
                    toast.error(result.error || 'Failed to create alert');
                }
            }
        } catch (error) {
            console.error('Alert submission error:', error);
            toast.error('Something went wrong');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent className="alert-dialog">
                <DialogHeader>
                    <DialogTitle className="alert-title">
                        {action === 'edit' ? 'Edit Alert' : 'Create Alert'}
                    </DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-5">
                    <div className="space-y-2">
                        <Label htmlFor="alertName" className="form-label">
                            Alert Name
                        </Label>
                        <Input
                            id="alertName"
                            type="text"
                            value={formData.alertName}
                            onChange={(e) => setFormData({ ...formData, alertName: e.target.value })}
                            className="form-input"
                            required
                        />
                    </div>

                    {alertData && (
                        <div className="space-y-2">
                            <Label className="form-label text-gray-500">Stock Identifier</Label>
                            <Input
                                type="text"
                                value={`${alertData.company} (${alertData.symbol})`}
                                className="form-input opacity-50"
                                disabled
                            />
                        </div>
                    )}

                    <div className="space-y-2">
                        <Label htmlFor="alertType" className="form-label">
                            Alert type
                        </Label>
                        <Select
                            value={formData.alertType}
                            onValueChange={(value) => setFormData({ ...formData, alertType: value })}
                        >
                            <SelectTrigger className="select-trigger">
                                <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                            <SelectContent className="bg-gray-800 border-gray-600">
                                <SelectItem value="price" className="focus:bg-gray-600 focus:text-white">
                                    Price
                                     </SelectItem>
                                {/*<SelectItem value="volume" className="focus:bg-gray-600 focus:text-white">
                                    Volume
                                </SelectItem>*/}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="condition" className="form-label">
                            Condition
                        </Label>
                        <Select
                            value={formData.condition}
                            onValueChange={(value) => setFormData({ ...formData, condition: value })}
                        >
                            <SelectTrigger className="select-trigger">
                                <SelectValue placeholder="Select condition" />
                            </SelectTrigger>
                            <SelectContent className="bg-gray-800 border-gray-600">
                                <SelectItem value="greater" className="focus:bg-gray-600 focus:text-white">
                                    Greater than (&gt;)
                                </SelectItem>
                                <SelectItem value="less" className="focus:bg-gray-600 focus:text-white">
                                    Less than (&lt;)
                                </SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="threshold" className="form-label">
                            {formData.alertType === 'price' ? 'Price Threshold' : 'Volume Threshold'}
                        </Label>
                        <div className="relative">
                            {formData.alertType === 'price' && (
                                <span className="absolute left-0.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none z-10">$</span>
                            )}
                            <Input
                                id="threshold"
                                type="number"
                                step={formData.alertType === 'price' ? '0.01' : '1000'}
                                value={formData.threshold}
                                onChange={(e) => setFormData({ ...formData, threshold: e.target.value })}
                                className={`form-input ${formData.alertType === 'price' ? 'pl-10' : ''}`}
                                placeholder={formData.alertType === 'price' ? '100.00' : '1000000'}
                                required
                            />
                        </div>
                        {formData.alertType === 'volume' && (
                            <p className="text-xs text-gray-500">
                                Enter volume in shares (e.g., 1000000 for 1 million shares)
                            </p>
                        )}
                    </div>

                    <div className="pt-4">
                        <Button
                            type="submit"
                            className="yellow-btn w-full"
                            disabled={loading}
                        >
                            {loading ? 'Saving...' : action === 'edit' ? 'Update Alert' : 'Create Alert'}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}