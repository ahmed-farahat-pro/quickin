'use client'

import Link from 'next/link'
import Image from 'next/image'
import { cn } from '@/lib/utils'
import { useLocale, useTranslations } from 'next-intl'
import { localizeHrefWithQuery } from '@/lib/i18n/pathname'
import { LocaleSwitcher } from '@/components/layout/locale-switcher'
import { IconBrandFacebook, IconBrandX, IconBrandInstagram, IconBrandLinkedin, IconBrandYoutube, IconBrandTiktok, IconLink } from '@tabler/icons-react'
import type { Locale } from '@/i18n/config'
import type { FooterConfig } from '@/types/site-settings'
import { DynamicIcon } from '@/components/ui/dynamic-icon'
import ReactMarkdown from 'react-markdown'

interface FooterProps {
  config?: FooterConfig
}

export function Footer({ config }: FooterProps)
{
  const locale = useLocale() as Locale
  const t = useTranslations('footer')
  const commonT = useTranslations('common')

  const localizedHref = (href: string) => localizeHrefWithQuery(href, locale)

  // Fallback links if CMS is empty or not configured
  const defaultFooterLinks = {
    support: [
      { label: t('supportLinks.helpCenter'), href: '/help' },
      { label: t('supportLinks.safetyInfo'), href: '/safety' },
      { label: t('supportLinks.cancellation'), href: '/cancellation' },
      { label: t('supportLinks.reportConcern'), href: '/report' },
    ],
    hosting: [
      { label: t('hostingLinks.becomeHost'), href: '/host' },
      { label: t('hostingLinks.hostResources'), href: '/resources' },
      { label: t('hostingLinks.communityForum'), href: '/community' },
      { label: t('hostingLinks.hostResponsibly'), href: '/responsible-hosting' },
    ],
    company: [
      { label: t('companyLinks.about'), href: '/about' },
      { label: t('companyLinks.newsroom'), href: '/newsroom' },
      { label: t('companyLinks.careers'), href: '/careers' },
      { label: t('companyLinks.contact'), href: '/contact' },
    ],
  }

  const hasCMSColumns = config?.columns && config.columns.length > 0;
  
  // Custom texts from CMS with fallbacks
  const customTagline = config?.tagline?.[locale as 'en' | 'ar'] || config?.tagline?.en || t('tagline');
  const customDescription = config?.description?.[locale as 'en' | 'ar'] || config?.description?.en || t('description');
  const customLegalCompanyName = config?.legal_company_name?.[locale as 'en' | 'ar'] || config?.legal_company_name?.en || t('legalCompanyName');
  const customCopyrightText = config?.copyright_text?.[locale as 'en' | 'ar'] || config?.copyright_text?.en;
  
  // Bottom links logic
  const customBottomLinks = config?.bottom_links || [];
  const hasCustomBottomLinks = customBottomLinks.length > 0;

  // Social links logic
  const customSocialLinks = config?.social_links || [];
  const hasCustomSocialLinks = customSocialLinks.length > 0;

  const getSocialIcon = (link: NonNullable<FooterConfig['social_links']>[0]) => {
    const cl = link.className || "h-5 w-5";

    if (link.icon) {
      return <DynamicIcon name={link.icon} className={cl} />;
    }

    if (link.image_url) {
      return <img src={link.image_url} alt={link.platform} className={cn("object-contain", cl)} />;
    }

    switch (link.platform) {
      case 'facebook': return <IconBrandFacebook className={cl} />;
      case 'twitter': return <IconBrandX className={cl} />;
      case 'instagram': return <IconBrandInstagram className={cl} />;
      case 'linkedin': return <IconBrandLinkedin className={cl} />;
      case 'youtube': return <IconBrandYoutube className={cl} />;
      case 'tiktok': return <IconBrandTiktok className={cl} />;
      case 'other':
      default: return <IconLink className={cl} />;
    }
  }

  return (
    <footer className='border-t border-border bg-secondary/50'>
      <div className='container mx-auto px-4 sm:px-6 lg:px-8'>
        {/* Links Grid */}
        <div className='grid grid-cols-1 md:grid-cols-4 gap-8 py-12'>
          {/* Brand */}
          <div className='md:col-span-1'>
            <Link href={localizedHref('/')} className='flex items-center gap-2 mb-4'>
              <Image
                src='/logo.png'
                alt={commonT('brand')}
                width={256}
                height={256}
                className='h-10 w-auto'
              />
            </Link>
            {customTagline && (
              <div className='text-sm text-muted-foreground mb-4 prose prose-sm prose-p:my-0 [&_a]:text-primary [&_a]:underline'>
                <ReactMarkdown components={{ p: ({node, ...props}) => <span {...props} /> }}>{customTagline}</ReactMarkdown>
              </div>
            )}
            {customDescription && (
              <div className='text-sm text-muted-foreground prose prose-sm prose-p:my-0 [&_a]:text-primary [&_a]:underline'>
                <ReactMarkdown components={{ p: ({node, ...props}) => <span {...props} /> }}>{customDescription}</ReactMarkdown>
              </div>
            )}
          </div>

          {hasCMSColumns ? (
            // Render Dynamic CMS Columns
            config.columns.map((col) => (
              <div key={col.id}>
                <h3 className='font-semibold mb-4 text-foreground'>{col.title[locale as 'en' | 'ar'] || col.title.en}</h3>
                <ul className='space-y-3'>
                  {col.links.map((link) => (
                    <li key={link.id}>
                      <Link
                        href={localizedHref(link.href)}
                        target={link.is_external ? "_blank" : undefined}
                        rel={link.is_external ? "noopener noreferrer" : undefined}
                        className='text-muted-foreground hover:text-foreground transition-colors text-sm'
                      >
                        {link.label[locale as 'en' | 'ar'] || link.label.en}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))
          ) : (
            // Render Default Hardcoded Columns
            <>
              {/* Support */}
              <div>
                <h3 className='font-semibold mb-4 text-foreground'>{t('support')}</h3>
                <ul className='space-y-3'>
                  {defaultFooterLinks.support.map((link) => (
                    <li key={link.href}>
                      <Link
                        href={localizedHref(link.href)}
                        className='text-muted-foreground hover:text-foreground transition-colors text-sm'
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Hosting */}
              <div>
                <h3 className='font-semibold mb-4 text-foreground'>{t('hosting')}</h3>
                <ul className='space-y-3'>
                  {defaultFooterLinks.hosting.map((link) => (
                    <li key={link.href}>
                      <Link
                        href={localizedHref(link.href)}
                        className='text-muted-foreground hover:text-foreground transition-colors text-sm'
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Company */}
              <div>
                <h3 className='font-semibold mb-4 text-foreground'>{t('company')}</h3>
                <ul className='space-y-3'>
                  {defaultFooterLinks.company.map((link) => (
                    <li key={link.href}>
                      <Link
                        href={localizedHref(link.href)}
                        className='text-muted-foreground hover:text-foreground transition-colors text-sm'
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}
        </div>

        {/* Bottom Bar */}
        <div className='border-t border-border py-6'>
          <div className='flex flex-col md:flex-row items-center justify-between gap-4'>
            <div className='flex flex-wrap items-center gap-2 text-sm text-muted-foreground'>
              {customCopyrightText ? (
                <div className='prose prose-sm prose-p:my-0 prose-p:text-muted-foreground [&_a]:text-foreground [&_a]:underline [&_a:hover]:text-foreground'>
                  <ReactMarkdown components={{ p: ({node, ...props}) => <span {...props} /> }}>{customCopyrightText}</ReactMarkdown>
                </div>
              ) : (
                <span>© {new Date().getFullYear()} {customLegalCompanyName}</span>
              )}
              
              {hasCustomBottomLinks ? (
                // Render CMS Bottom Links
                customBottomLinks.map((link) => (
                  <span key={link.id} className="flex items-center gap-2">
                    <span>·</span>
                    <Link 
                      href={localizedHref(link.href)} 
                      target={link.is_external ? "_blank" : undefined}
                      rel={link.is_external ? "noopener noreferrer" : undefined}
                      className='hover:underline hover:text-foreground transition-colors'
                    >
                      {link.label[locale as 'en' | 'ar'] || link.label.en}
                    </Link>
                  </span>
                ))
              ) : (
                // Render Default Bottom Links
                <>
                  <span>·</span>
                  <Link href={localizedHref('/terms')} className='hover:underline hover:text-foreground transition-colors'>
                    {t('terms')}
                  </Link>
                  <span>·</span>
                  <Link href={localizedHref('/sitemap')} className='hover:underline hover:text-foreground transition-colors'>
                    {t('sitemap')}
                  </Link>
                  <span>·</span>
                  <Link href={localizedHref('/privacy')} className='hover:underline hover:text-foreground transition-colors'>
                    {t('privacy')}
                  </Link>
                </>
              )}
            </div>

            {hasCustomSocialLinks && (
              <div className='flex items-center gap-4 justify-center'>
                {customSocialLinks.map((link) => (
                  <Link
                    key={link.id || link.platform}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <span className="sr-only">{link.platform}</span>
                    {getSocialIcon(link)}
                  </Link>
                ))}
              </div>
            )}

            <div className='flex items-center gap-4'>
              <LocaleSwitcher className='flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors' />
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}
