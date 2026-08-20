import { redirect } from 'next/navigation';

/**
 * 新闻板块已下线（无互联网新闻信息服务资质）。
 * 原独立新闻页重定向回见天地，渲染逻辑保留在 src/components/WorldNewsView.tsx，
 * 取得资质或与持牌媒体合作后可恢复。
 */
export default function WorldPage() {
  redirect('/?tab=guanshi');
}
