
'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Video, MessageSquareText, Users, Palette, Activity, BarChart3, BookOpenCheck } from "lucide-react";
import { useTranslation } from '@/context/I18nContext';

export default function AdminDashboardPage() {
  const { t } = useTranslation();

  const overviewCards = [
    { titleKey: "adminDashboard.overview.totalCourses", value: "0", icon: BookOpenCheck, color: "text-primary", href: "/admin/courses" }, // Value updated once courses are from DB
    { titleKey: "adminDashboard.overview.pendingTestimonials", value: "0", icon: MessageSquareText, color: "text-yellow-400", href: "/admin/testimonials" }, // Value updated once testimonials are from DB
    { titleKey: "adminDashboard.overview.activeUsers", value: "0", icon: Users, color: "text-green-400", href: "/admin/users" }, // Value updated once users are from DB
    { titleKey: "adminDashboard.overview.siteActivity", valueKey: "adminDashboard.overview.siteActivityHigh", icon: Activity, color: "text-blue-400", href: "#" }, // Placeholder href
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="font-headline text-3xl font-bold text-primary">{t('adminDashboard.title')}</h1>
          <p className="text-muted-foreground">{t('adminDashboard.description')}</p>
        </div>
        <Button asChild>
          <Link href="/admin/appearance">
            <Palette className="mr-2 h-4 w-4" /> {t('adminDashboard.customizeAppearanceButton')}
          </Link>
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {overviewCards.map(item => (
          <Card key={item.titleKey} className="shadow-lg hover:shadow-primary/10 transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{t(item.titleKey)}</CardTitle>
              <item.icon className={`h-5 w-5 ${item.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{item.valueKey ? t(item.valueKey) : item.value}</div>
              <Link href={item.href || "#"} className="text-xs text-muted-foreground hover:text-primary transition-colors pt-1">
                {t('adminDashboard.viewDetailsLink')}
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>
      
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="font-headline text-xl text-primary">{t('adminDashboard.recentActivity.title')}</CardTitle>
            <CardDescription>{t('adminDashboard.recentActivity.description')}</CardDescription>
          </CardHeader>
          <CardContent>
            {/* Placeholder for recent activity feed - consider making dynamic */}
            <ul className="space-y-3 text-sm">
              <li className="flex items-center"><Users className="h-4 w-4 mr-2 text-green-400" /> {t('adminDashboard.recentActivity.newUser')}</li>
              <li className="flex items-center"><MessageSquareText className="h-4 w-4 mr-2 text-yellow-400" /> {t('adminDashboard.recentActivity.pendingTestimonial')}</li>
              <li className="flex items-center"><Video className="h-4 w-4 mr-2 text-primary" /> {t('adminDashboard.recentActivity.newVideo')}</li>
            </ul>
          </CardContent>
        </Card>
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="font-headline text-xl text-primary">{t('adminDashboard.quickStats.title')}</CardTitle>
            <CardDescription>{t('adminDashboard.quickStats.description')}</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-center h-48">
            {/* Placeholder for a chart or stats */}
            <BarChart3 className="h-24 w-24 text-muted-foreground/50" />
            <p className="ml-4 text-muted-foreground">{t('adminDashboard.quickStats.comingSoon')}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
